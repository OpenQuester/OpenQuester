#

```bash
## Environment type ("dev" | "prod" | "test")
ENV=

# "*" will allow all origins. To set specific origin domain use this: "localhost,some-host,another-host"
# Important for custom hosts - Do not set leading dot ".", type only domain itself.
CORS_ORIGINS=
# Optional, by default will use CORS_ORIGINS
SOCKET_IO_CORS_ORIGINS=
SOCKET_IO_ADMIN_UI_ENABLE=
SOCKET_IO_ADMIN_UI_USERNAME=
SOCKET_IO_ADMIN_UI_PASSWORD=

# Domain (full) to which cookie will be assigned
API_DOMAIN=

## DB variables
DB_TYPE=
DB_NAME=
DB_USER=
DB_PASS=
DB_HOST=
DB_PORT=

# Redis
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_HOST=
REDIS_PORT=
REDIS_DB_NUMBER=

# Logs
# "trace" < "debug" < "info" < "warn" < "error";
LOG_LEVEL=

# "all" or boolean or "query" | "schema" | "error" | "warn" | "info" | "log" | "migration"
# More about DB logging: https://typeorm.io/logging#logging
DB_LOGGER=

## Storage
# e.g. "s3"
STORAGE_TYPE=
# e.g. "minio"
STORAGE_NAME=

# Folder in S3 bucket that will be ignored by the cleanup job (e.g., "protected/" or folders of another project)
IGNORE_S3_FILES_CLEANUP_FOLDER="protected/"

# Cron expression for S3 cleanup job (default: "0 0 2 * * *" - daily at 2 AM UTC)
# Format: second minute hour day-of-month month day-of-week
# Examples: "0 0 2 * * *" (daily 2 AM), "0 0 */6 * * *" (every 6 hours), "0 * * * * *" (every minute - testing only)
CRON_S3_CLEANUP_EXPRESSION="0 0 2 * * *"

# S3

# Should include http(s). Used to create connection to S3, so this is required even if S3_USE_SUB_DOMAIN_BUCKET_FORMAT is true
S3_ENDPOINT=
# Should include http(s) and bucket name as subdomain, e.g. https://bucket.s3domain.com
# This is not required if S3_USE_SUB_DOMAIN_BUCKET_FORMAT is false
S3_URL_PREFIX=

# If true, use subdomain bucket format for S3 URLs (e.g. https://bucket.s3domain.com/file-path which is S3_URL_PREFIX/file-path)
# If false, use path-style (e.g. http://localhost:9000/bucket/file-path which is S3_ENDPOINT/S3_BUCKET/file-path)
S3_USE_SUB_DOMAIN_BUCKET_FORMAT=

# Bucket is required even if S3_USE_SUB_DOMAIN_BUCKET_FORMAT is true, same as all other variables
S3_BUCKET=
S3_USE_SSL=
S3_PORT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```
