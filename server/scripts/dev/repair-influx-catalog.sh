#!/usr/bin/env sh
# Repairs local InfluxDB startup by backing up the volume and moving zero-byte catalog logs aside.
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
cd "$ROOT_DIR"

TIMESTAMP="$(date +%Y%m%d%H%M%S)"
BACKUP_DIR="${INFLUX_BACKUP_DIR:-/tmp}"
CATALOG_LOG_DIR="/data/node0/catalog/v2/logs"
CORRUPT_BACKUP_DIR="/data/_corrupt-backup/catalog/v2/logs/${TIMESTAMP}"

VOLUME_NAME="${INFLUX_VOLUME:-}"
if [ -z "$VOLUME_NAME" ]; then
  VOLUME_NAME="$(docker inspect influxdb3 --format '{{range .Mounts}}{{if eq .Destination "/var/lib/influxdb3/data"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || true)"
fi

if [ -z "$VOLUME_NAME" ]; then
  VOLUME_NAME="server_influxdb3_data"
fi

BACKUP_PATH="${BACKUP_DIR}/openquester-influxdb3-data-before-catalog-repair-${TIMESTAMP}.tgz"

echo "Using InfluxDB volume: ${VOLUME_NAME}"
echo "Scanning for zero-byte catalog logs..."
ZERO_BYTE_FILES="$(
  docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    alpine:3.20 \
    sh -c "
      set -eu
      if [ ! -d '${CATALOG_LOG_DIR}' ]; then
        echo 'missing-catalog-log-dir'
        exit 2
      fi

      for file in '${CATALOG_LOG_DIR}'/*.catalog; do
        [ -e \"\$file\" ] || continue
        if [ ! -s \"\$file\" ]; then
          echo \"\$file\"
        fi
      done
    "
)"

if printf "%s\n" "$ZERO_BYTE_FILES" | grep -q "missing-catalog-log-dir"; then
  echo "InfluxDB catalog log directory was not found in volume '${VOLUME_NAME}'." >&2
  exit 1
fi

if [ -z "$ZERO_BYTE_FILES" ]; then
  echo "No zero-byte catalog logs found. No repair needed."
  exit 0
fi

printf "%s\n" "$ZERO_BYTE_FILES"

echo "Stopping InfluxDB before volume repair..."
docker compose stop influxdb3

echo "Creating volume backup: ${BACKUP_PATH}"
docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "${BACKUP_DIR}:/backup" \
  alpine:3.20 \
  tar -czf "/backup/$(basename "$BACKUP_PATH")" -C /data .

echo "Moving zero-byte catalog logs aside..."
MOVED_FILES="$(
  docker run --rm \
    -v "${VOLUME_NAME}:/data" \
    alpine:3.20 \
    sh -c "
      set -eu
      if [ ! -d '${CATALOG_LOG_DIR}' ]; then
        echo 'missing-catalog-log-dir'
        exit 2
      fi

      mkdir -p '${CORRUPT_BACKUP_DIR}'
      moved=0
      for file in '${CATALOG_LOG_DIR}'/*.catalog; do
        [ -e \"\$file\" ] || continue
        if [ ! -s \"\$file\" ]; then
          mv \"\$file\" '${CORRUPT_BACKUP_DIR}'/
          echo \"\$file\"
          moved=\$((moved + 1))
        fi
      done

      if [ \"\$moved\" -eq 0 ]; then
        echo 'no-zero-byte-catalog-logs'
      fi
    "
)"

printf "%s\n" "$MOVED_FILES"

if printf "%s\n" "$MOVED_FILES" | grep -q "missing-catalog-log-dir"; then
  echo "InfluxDB catalog log directory was not found in volume '${VOLUME_NAME}'." >&2
  exit 1
fi

if printf "%s\n" "$MOVED_FILES" | grep -q "no-zero-byte-catalog-logs"; then
  echo "No zero-byte catalog logs remained after stopping InfluxDB. Restarting service." >&2
  docker compose up -d influxdb3 influxdb3-init
  exit 1
fi

echo "Restarting InfluxDB and init job..."
docker compose up -d influxdb3 influxdb3-init

echo "Waiting for InfluxDB gate to pass..."
scripts/dev/check-influx.sh

echo "InfluxDB catalog repair complete. Backup: ${BACKUP_PATH}"
