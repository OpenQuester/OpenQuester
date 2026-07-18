package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

const insertEvent = `
INSERT INTO runtime_benchmark.events (
  run_id,
  event_id,
  runtime,
  game_id,
  player_id,
  score_delta,
  payload
) VALUES ($1, $2, 'go', $3, $4, $5, $6)`

type benchmarkEvent struct {
	RunID      string `json:"run_id"`
	EventID    int64  `json:"event_id"`
	GameID     int    `json:"game_id"`
	PlayerID   int64  `json:"player_id"`
	ScoreDelta int    `json:"score_delta"`
	Payload    string `json:"payload"`
}

type config struct {
	port             int
	workers          int
	postgresHost     string
	postgresPort     int
	postgresDatabase string
	postgresUser     string
	postgresPassword string
	dbPoolSize       int
	redisHost        string
	redisPort        int
	redisPassword    string
	redisDatabase    int
}

type application struct {
	postgres *pgxpool.Pool
	redis    *redis.Client
}

func main() {
	cfg := configFromEnvironment()
	runtime.GOMAXPROCS(cfg.workers)

	ctx := context.Background()
	postgresConfig, err := pgxpool.ParseConfig(fmt.Sprintf(
		"host=%s port=%d dbname=%s user=%s password=%s sslmode=disable pool_max_conns=%d",
		cfg.postgresHost,
		cfg.postgresPort,
		cfg.postgresDatabase,
		cfg.postgresUser,
		cfg.postgresPassword,
		cfg.dbPoolSize,
	))
	if err != nil {
		log.Fatal(err)
	}
	postgres, err := pgxpool.NewWithConfig(ctx, postgresConfig)
	if err != nil {
		log.Fatal(err)
	}
	defer postgres.Close()

	redisClient := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.redisHost, cfg.redisPort),
		Password: cfg.redisPassword,
		DB:       cfg.redisDatabase,
		PoolSize: cfg.dbPoolSize,
	})
	defer redisClient.Close()

	if err := postgres.Ping(ctx); err != nil {
		log.Fatalf("postgres ping: %v", err)
	}
	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}
	if _, err := postgres.Exec(ctx, "CREATE SCHEMA IF NOT EXISTS runtime_benchmark"); err != nil {
		log.Fatal(err)
	}
	if _, err := postgres.Exec(ctx, `
CREATE TABLE IF NOT EXISTS runtime_benchmark.events (
  run_id text NOT NULL,
  event_id bigint NOT NULL,
  runtime text NOT NULL,
  game_id integer NOT NULL,
  player_id bigint NOT NULL,
  score_delta integer NOT NULL,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, runtime, event_id)
)`); err != nil {
		log.Fatal(err)
	}

	app := &application{postgres: postgres, redis: redisClient}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", app.health)
	mux.HandleFunc("POST /event", app.event)

	server := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.port),
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	go func() {
		log.Printf("go server listening on %d; workers=%d; pool=%d", cfg.port, cfg.workers, cfg.dbPoolSize)
		if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			log.Fatal(err)
		}
	}()

	stop, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	<-stop.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
}

func (app *application) health(writer http.ResponseWriter, request *http.Request) {
	writer.WriteHeader(http.StatusOK)
	_, _ = writer.Write([]byte("ok"))
}

func (app *application) event(writer http.ResponseWriter, request *http.Request) {
	defer request.Body.Close()
	var event benchmarkEvent
	if err := json.NewDecoder(request.Body).Decode(&event); err != nil {
		http.Error(writer, "invalid JSON", http.StatusBadRequest)
		return
	}

	redisKey := fmt.Sprintf("openquester:runtime-benchmark:%s:go", event.RunID)
	if err := app.redis.HIncrBy(request.Context(), redisKey, strconv.Itoa(event.GameID), 1).Err(); err != nil {
		http.Error(writer, "redis write failed", http.StatusInternalServerError)
		return
	}
	if _, err := app.postgres.Exec(
		request.Context(),
		insertEvent,
		event.RunID,
		event.EventID,
		event.GameID,
		event.PlayerID,
		event.ScoreDelta,
		event.Payload,
	); err != nil {
		http.Error(writer, "postgres write failed", http.StatusInternalServerError)
		return
	}

	writer.WriteHeader(http.StatusNoContent)
}

func configFromEnvironment() config {
	return config{
		port:             envInt("PORT", 18080),
		workers:          envInt("APP_WORKERS", 1),
		postgresHost:     envString("POSTGRES_HOST", "127.0.0.1"),
		postgresPort:     envInt("POSTGRES_PORT", 5432),
		postgresDatabase: envString("POSTGRES_DATABASE", "postgres"),
		postgresUser:     envString("POSTGRES_USER", "admin"),
		postgresPassword: envString("POSTGRES_PASSWORD", ""),
		dbPoolSize:       envInt("DB_POOL_SIZE", 24),
		redisHost:        envString("REDIS_HOST", "127.0.0.1"),
		redisPort:        envInt("REDIS_PORT", 6379),
		redisPassword:    envString("REDIS_PASSWORD", ""),
		redisDatabase:    envInt("REDIS_DATABASE", 0),
	}
}

func envString(name string, fallback string) string {
	if value, ok := os.LookupEnv(name); ok {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value, ok := os.LookupEnv(name)
	if !ok {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		log.Fatalf("invalid %s: %v", name, err)
	}
	return parsed
}
