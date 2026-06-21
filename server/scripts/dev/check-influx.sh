#!/usr/bin/env sh
# Verifies local InfluxDB is healthy, has the app database, and accepts writes.
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

DATABASE="${INFLUX_DATABASE:-openquester}"
HOST_URL="${INFLUX_HOST_URL:-http://localhost:8181}"
ENV_FILE_INFLUX_URL=""

if [ -f .env ]; then
  ENV_FILE_INFLUX_URL="$(
    node <<'NODE'
const fs = require("fs");

const line = fs.readFileSync(".env", "utf8")
  .split(/\r?\n/)
  .find((entry) => /^\s*INFLUX_URL\s*=/.test(entry));

if (line) {
  const value = line
    .replace(/^\s*INFLUX_URL\s*=\s*/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  process.stdout.write(value);
}
NODE
  )"
fi

CLIENT_URL="${INFLUX_URL:-${ENV_FILE_INFLUX_URL:-${HOST_URL}/?database=${DATABASE}}}"

if [ -z "${INFLUX_DATABASE:-}" ]; then
  URL_DATABASE="$(
    INFLUX_CHECK_URL="$CLIENT_URL" node <<'NODE'
const url = new URL(process.env.INFLUX_CHECK_URL);
process.stdout.write(url.searchParams.get("database") || url.searchParams.get("bucket") || "");
NODE
  )"

  if [ -n "$URL_DATABASE" ]; then
    DATABASE="$URL_DATABASE"
  fi
fi

echo "Checking InfluxDB Compose service..."
docker compose ps influxdb3

echo "Checking InfluxDB databases from inside the container..."
DATABASES="$(docker compose exec -T influxdb3 influxdb3 show databases -H http://localhost:8181)"
printf "%s\n" "$DATABASES"

if ! printf "%s\n" "$DATABASES" | grep -Eq "\\|[[:space:]]*${DATABASE}[[:space:]]*\\|"; then
  echo "InfluxDB database '${DATABASE}' is missing." >&2
  echo "Run: docker compose up -d influxdb3 influxdb3-init" >&2
  exit 1
fi

echo "Checking InfluxDB host reachability and write path..."
INFLUX_CHECK_URL="$CLIENT_URL" INFLUX_DATABASE="$DATABASE" node <<'NODE'
const { InfluxDBClient, Point } = require("@influxdata/influxdb3-client");

const database = process.env.INFLUX_DATABASE || "openquester";
const url = new URL(process.env.INFLUX_CHECK_URL || `http://localhost:8181/?database=${database}`);

if (!url.searchParams.has("database") && !url.searchParams.has("bucket")) {
  url.searchParams.set("database", database);
}

if (!url.searchParams.has("token")) {
  url.searchParams.set("token", "unused");
}

const client = new InfluxDBClient(url.toString());

(async () => {
  const version = await client.getServerVersion();
  const point = Point.measurement("dev_influx_healthcheck")
    .setTag("source", "check-influx")
    .setIntegerField("value", 1);

  await client.write([point], database);
  await client.close();

  console.log(`InfluxDB client OK: version ${version}, write OK to ${database}`);
})().catch(async (error) => {
  try {
    await client.close();
  } catch {
    // Ignore close failures while reporting the original error.
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
NODE
