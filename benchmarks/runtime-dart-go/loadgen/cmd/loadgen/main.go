package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

type options struct {
	url         string
	runtime     string
	runID       string
	cores       int
	repetition  int
	concurrency int
	warmup      time.Duration
	duration    time.Duration
}

type workerResult struct {
	latencies []int64
	errors    int64
}

type result struct {
	Runtime         string  `json:"runtime"`
	ApplicationCPUs int     `json:"application_cpus"`
	Repetition      int     `json:"repetition"`
	RunID           string  `json:"run_id"`
	Concurrency     int     `json:"concurrency"`
	DurationS       float64 `json:"duration_s"`
	Requests        int64   `json:"requests"`
	Errors          int64   `json:"errors"`
	RequestsPerS    float64 `json:"requests_per_s"`
	P50MS           float64 `json:"p50_ms"`
	P95MS           float64 `json:"p95_ms"`
	P99MS           float64 `json:"p99_ms"`
}

func main() {
	opts := parseFlags()
	transport := &http.Transport{
		MaxIdleConns:        opts.concurrency,
		MaxIdleConnsPerHost: opts.concurrency,
		MaxConnsPerHost:     opts.concurrency,
		IdleConnTimeout:     30 * time.Second,
	}
	client := &http.Client{Transport: transport, Timeout: 10 * time.Second}
	defer transport.CloseIdleConnections()

	var eventID atomic.Int64
	if opts.warmup > 0 {
		warmupOptions := opts
		warmupOptions.runID += "-warmup"
		runPhase(client, warmupOptions, &eventID, opts.warmup, false)
	}

	started := time.Now()
	measured := runPhase(client, opts, &eventID, opts.duration, true)
	elapsed := time.Since(started)

	latencies := make([]int64, 0)
	var failures int64
	for _, worker := range measured {
		latencies = append(latencies, worker.latencies...)
		failures += worker.errors
	}
	sort.Slice(latencies, func(i, j int) bool { return latencies[i] < latencies[j] })

	measurement := result{
		Runtime:         opts.runtime,
		ApplicationCPUs: opts.cores,
		Repetition:      opts.repetition,
		RunID:           opts.runID,
		Concurrency:     opts.concurrency,
		DurationS:       elapsed.Seconds(),
		Requests:        int64(len(latencies)),
		Errors:          failures,
		RequestsPerS:    float64(len(latencies)) / elapsed.Seconds(),
		P50MS:           percentileMilliseconds(latencies, 0.50),
		P95MS:           percentileMilliseconds(latencies, 0.95),
		P99MS:           percentileMilliseconds(latencies, 0.99),
	}

	encoded, err := json.Marshal(measurement)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(string(encoded))
}

func parseFlags() options {
	var opts options
	flag.StringVar(&opts.url, "url", "http://127.0.0.1:18080/event", "event endpoint")
	flag.StringVar(&opts.runtime, "runtime", "unknown", "runtime label")
	flag.StringVar(&opts.runID, "run-id", "manual", "unique run ID")
	flag.IntVar(&opts.cores, "cores", 1, "application CPU count")
	flag.IntVar(&opts.repetition, "repetition", 1, "repetition number")
	flag.IntVar(&opts.concurrency, "concurrency", 64, "parallel HTTP workers")
	flag.DurationVar(&opts.warmup, "warmup", 5*time.Second, "warmup duration")
	flag.DurationVar(&opts.duration, "duration", 15*time.Second, "measurement duration")
	flag.Parse()
	return opts
}

func runPhase(
	client *http.Client,
	opts options,
	eventID *atomic.Int64,
	duration time.Duration,
	record bool,
) []workerResult {
	deadline := time.Now().Add(duration)
	results := make(chan workerResult, opts.concurrency)
	var waitGroup sync.WaitGroup

	for worker := 0; worker < opts.concurrency; worker++ {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			local := workerResult{latencies: make([]int64, 0, 1024)}
			for time.Now().Before(deadline) {
				id := eventID.Add(1)
				body := []byte(fmt.Sprintf(
					`{"run_id":%q,"event_id":%d,"game_id":%d,"player_id":%d,"score_delta":10,"payload":"openquester-runtime-benchmark"}`,
					opts.runID,
					id,
					id%128,
					id%2048,
				))
				request, err := http.NewRequest(http.MethodPost, opts.url, bytes.NewReader(body))
				if err != nil {
					local.errors++
					continue
				}
				request.Header.Set("Content-Type", "application/json")
				started := time.Now()
				response, err := client.Do(request)
				latency := time.Since(started).Nanoseconds()
				if err != nil {
					local.errors++
					continue
				}
				_, _ = io.Copy(io.Discard, response.Body)
				_ = response.Body.Close()
				if response.StatusCode != http.StatusNoContent {
					local.errors++
					continue
				}
				if record {
					local.latencies = append(local.latencies, latency)
				}
			}
			results <- local
		}()
	}

	waitGroup.Wait()
	close(results)
	all := make([]workerResult, 0, opts.concurrency)
	for worker := range results {
		all = append(all, worker)
	}
	return all
}

func percentileMilliseconds(values []int64, percentile float64) float64 {
	if len(values) == 0 {
		return 0
	}
	index := int(float64(len(values)-1) * percentile)
	return float64(values[index]) / float64(time.Millisecond)
}
