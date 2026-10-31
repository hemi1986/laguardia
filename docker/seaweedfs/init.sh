#!/bin/sh
# One-off init step of the local object store (ST-099, ADR 0012): creates the local buckets and gives each the CORS
# rule of its local origin – `laguardia-dev` for the dev server (port 3000), `laguardia-e2e` for the local browser tests
# (port 3100), `laguardia-test` for the integration tests. Runs against SeaweedFS with its fixed development identity; any refusal fails `npm run db:up`.
set -eu

store="http://seaweedfs:8333"
sign() {
  curl --fail-with-body --silent --show-error --aws-sigv4 "aws:amz:us-east-1:s3" \
    --user "$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" "$@"
}

bucket() {
  name="$1"
  origin="$2"
  # 409 BucketAlreadyOwnedByYou on a second start – the bucket stays as it is
  status=$(curl --silent --aws-sigv4 "aws:amz:us-east-1:s3" --user "$S3_ACCESS_KEY_ID:$S3_SECRET_ACCESS_KEY" \
    -o /dev/null -w '%{http_code}' -X PUT "$store/$name" || true)
  case "$status" in
    200 | 409) ;;
    *) echo "Could not create bucket $name (HTTP $status)" >&2; exit 1 ;;
  esac
  cors="<CORSConfiguration><CORSRule><AllowedOrigin>$origin</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3000</MaxAgeSeconds></CORSRule></CORSConfiguration>"

  sign -X PUT "$store/$name?cors" -H "Content-Type: application/xml" --data-binary "$cors"
  echo "Bucket $name ready, CORS for $origin"
}

bucket laguardia-dev http://localhost:3000
bucket laguardia-e2e http://localhost:3100
# The S3 adapter's integration tests (`npm test`, CI) – a bucket of their own, as they have a database of their own.
bucket laguardia-test http://localhost:3100
