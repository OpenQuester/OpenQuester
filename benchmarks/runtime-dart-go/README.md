# Dart vs Go Redis/PostgreSQL benchmark

This harness compares small production-style HTTP event processors written in
Dart and Go. It is intentionally separate from the OpenQuester server so the
same request and persistence work can be measured without framework-specific
application logic.

Each `POST /event` request performs the same ordered work:

1. Decode a JSON event.
2. Increment a namespaced Redis counter.
3. Insert one row into PostgreSQL.
4. Return HTTP `204` only after both writes complete.

The Dart service is compiled AOT and uses one shared-port isolate per configured
application core. The Go service is compiled to a native binary and limits
`GOMAXPROCS` to the configured application core count.

## Layout

- `dart-server/` — Dart AOT HTTP server.
- `go-server/` — Go HTTP server.
- `loadgen/` — common Go HTTP load generator used for both targets.
- `scripts/run.sh` — builds images and runs the test matrix.
- `results/` — committed reports and raw JSONL measurements.

## Requirements

- Docker with access to the host network.
- Reachable Redis and PostgreSQL instances.
- A PostgreSQL account allowed to create the dedicated
  `runtime_benchmark` schema.

No credentials are stored in the repository. Export them only for the benchmark
process:

```bash
export BENCH_POSTGRES_PASSWORD='...'
```

Optional connection settings and test controls are documented by:

```bash
benchmarks/runtime-dart-go/scripts/run.sh --help
```

The default matrix is one application core and three application cores. Three
cores are used instead of all four on the measured host so one core remains
available to the load generator. PostgreSQL, Redis, and unrelated host services
are not CPU-isolated, so results describe this host under its normal background
load rather than laboratory-quality language limits.

## Run

From the repository root:

```bash
benchmarks/runtime-dart-go/scripts/run.sh
```

The script writes raw JSONL measurements under `results/`. It removes its
short-lived service containers on exit. Benchmark rows and Redis keys are
namespaced by run ID; set `BENCH_CLEANUP=1` (the default) to delete them after
the run.

The build images and language dependency locks are pinned. The latest committed
host result and interpretation are in
[`results/2026-07-18-server.md`](results/2026-07-18-server.md).

## Interpretation

This test measures the complete combination of language runtime, HTTP stack,
Redis driver, PostgreSQL driver, and concurrency model. It does not isolate the
compiler or CPU execution speed. When PostgreSQL is saturated, both runtimes
should converge toward the same database ceiling.
