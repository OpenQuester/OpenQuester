#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
RESULTS_DIR="$ROOT_DIR/results"
RUN_STAMP=$(date -u +%Y%m%dT%H%M%SZ)
RESULT_FILE="$RESULTS_DIR/$RUN_STAMP.jsonl"

if [ "${1:-}" = "--help" ]; then
  cat <<'USAGE'
Usage: benchmarks/runtime-dart-go/scripts/run.sh

Required:
  BENCH_POSTGRES_PASSWORD   PostgreSQL password (never written to results)

Optional connection settings:
  BENCH_POSTGRES_HOST       default: 127.0.0.1
  BENCH_POSTGRES_PORT       default: 5432
  BENCH_POSTGRES_DATABASE   default: postgres
  BENCH_POSTGRES_USER       default: admin
  BENCH_REDIS_HOST          default: 127.0.0.1
  BENCH_REDIS_PORT          default: 6379
  BENCH_REDIS_PASSWORD      default: empty
  BENCH_REDIS_DATABASE      default: 0

Optional test settings:
  BENCH_CPU_MATRIX          default: "1 3"
  BENCH_REPETITIONS         default: 3
  BENCH_CONCURRENCY         default: 64
  BENCH_WARMUP              default: 5s
  BENCH_DURATION            default: 15s
  BENCH_DB_POOL_SIZE        default: 24
  BENCH_CPUSET_SINGLE       default: 0
  BENCH_CPUSET_MULTI        default: 0-2
  BENCH_LOADGEN_CPUSET      default: 3
  BENCH_CLEANUP             default: 1
USAGE
  exit 0
fi

: "${BENCH_POSTGRES_PASSWORD:?BENCH_POSTGRES_PASSWORD must be set}"

POSTGRES_HOST=${BENCH_POSTGRES_HOST:-127.0.0.1}
POSTGRES_PORT=${BENCH_POSTGRES_PORT:-5432}
POSTGRES_DATABASE=${BENCH_POSTGRES_DATABASE:-postgres}
POSTGRES_USER=${BENCH_POSTGRES_USER:-admin}
REDIS_HOST=${BENCH_REDIS_HOST:-127.0.0.1}
REDIS_PORT=${BENCH_REDIS_PORT:-6379}
REDIS_PASSWORD=${BENCH_REDIS_PASSWORD:-}
REDIS_DATABASE=${BENCH_REDIS_DATABASE:-0}
CPU_MATRIX=${BENCH_CPU_MATRIX:-"1 3"}
REPETITIONS=${BENCH_REPETITIONS:-3}
CONCURRENCY=${BENCH_CONCURRENCY:-64}
WARMUP=${BENCH_WARMUP:-5s}
DURATION=${BENCH_DURATION:-15s}
DB_POOL_SIZE=${BENCH_DB_POOL_SIZE:-24}
CPUSET_SINGLE=${BENCH_CPUSET_SINGLE:-0}
CPUSET_MULTI=${BENCH_CPUSET_MULTI:-0-2}
LOADGEN_CPUSET=${BENCH_LOADGEN_CPUSET:-3}
CLEANUP=${BENCH_CLEANUP:-1}
SERVER_NAME=openquester-runtime-benchmark-server

mkdir -p "$RESULTS_DIR"

cleanup_server() {
  docker rm -f "$SERVER_NAME" >/dev/null 2>&1 || true
}
trap cleanup_server EXIT INT TERM

docker build -t openquester-benchmark-dart "$ROOT_DIR/dart-server"
docker build -t openquester-benchmark-go "$ROOT_DIR/go-server"
docker build -t openquester-benchmark-loadgen "$ROOT_DIR/loadgen"

for runtime in dart go; do
  for cores in $CPU_MATRIX; do
    if [ "$cores" -eq 1 ]; then
      cpuset=$CPUSET_SINGLE
    else
      cpuset=$CPUSET_MULTI
    fi

    cleanup_server
    docker run -d \
      --name "$SERVER_NAME" \
      --network host \
      --cpuset-cpus "$cpuset" \
      -e PORT=18080 \
      -e APP_WORKERS="$cores" \
      -e POSTGRES_HOST="$POSTGRES_HOST" \
      -e POSTGRES_PORT="$POSTGRES_PORT" \
      -e POSTGRES_DATABASE="$POSTGRES_DATABASE" \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$BENCH_POSTGRES_PASSWORD" \
      -e DB_POOL_SIZE="$DB_POOL_SIZE" \
      -e REDIS_HOST="$REDIS_HOST" \
      -e REDIS_PORT="$REDIS_PORT" \
      -e REDIS_PASSWORD="$REDIS_PASSWORD" \
      -e REDIS_DATABASE="$REDIS_DATABASE" \
      "openquester-benchmark-$runtime" >/dev/null

    attempts=0
    until docker run --rm --network host --entrypoint wget \
      openquester-benchmark-loadgen \
      -q -O /dev/null http://127.0.0.1:18080/health; do
      attempts=$((attempts + 1))
      if [ "$attempts" -ge 30 ]; then
        docker logs "$SERVER_NAME"
        exit 1
      fi
      sleep 1
    done

    repetition=1
    while [ "$repetition" -le "$REPETITIONS" ]; do
      run_id="${RUN_STAMP}-${runtime}-${cores}c-r${repetition}"
      docker run --rm \
        --network host \
        --cpuset-cpus "$LOADGEN_CPUSET" \
        openquester-benchmark-loadgen \
        -url http://127.0.0.1:18080/event \
        -runtime "$runtime" \
        -run-id "$run_id" \
        -cores "$cores" \
        -repetition "$repetition" \
        -concurrency "$CONCURRENCY" \
        -warmup "$WARMUP" \
        -duration "$DURATION" >>"$RESULT_FILE"
      repetition=$((repetition + 1))
    done
  done
done

cleanup_server

if [ "$CLEANUP" -eq 1 ]; then
  docker run --rm --network host \
    -e PGPASSWORD="$BENCH_POSTGRES_PASSWORD" \
    postgres:14-alpine \
    psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
      -d "$POSTGRES_DATABASE" -v ON_ERROR_STOP=1 \
      -c "DELETE FROM runtime_benchmark.events WHERE run_id LIKE '${RUN_STAMP}-%'" \
      >/dev/null

  for runtime in dart go; do
    for cores in $CPU_MATRIX; do
      repetition=1
      while [ "$repetition" -le "$REPETITIONS" ]; do
        run_id="${RUN_STAMP}-${runtime}-${cores}c-r${repetition}"
        if [ -n "$REDIS_PASSWORD" ]; then
          docker run --rm --network host -e REDISCLI_AUTH="$REDIS_PASSWORD" \
            redis:7.2-alpine redis-cli \
            -h "$REDIS_HOST" -p "$REDIS_PORT" \
            -n "$REDIS_DATABASE" DEL \
            "openquester:runtime-benchmark:${run_id}:${runtime}" \
            "openquester:runtime-benchmark:${run_id}-warmup:${runtime}" >/dev/null
        else
          docker run --rm --network host redis:7.2-alpine redis-cli \
            -h "$REDIS_HOST" -p "$REDIS_PORT" -n "$REDIS_DATABASE" DEL \
            "openquester:runtime-benchmark:${run_id}:${runtime}" \
            "openquester:runtime-benchmark:${run_id}-warmup:${runtime}" >/dev/null
        fi
        repetition=$((repetition + 1))
      done
    done
  done
fi

printf '%s\n' "$RESULT_FILE"
