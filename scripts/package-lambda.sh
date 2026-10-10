#!/bin/sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OUTPUT_PATH=${1:-"$PROJECT_ROOT/dist/foundly-lambda.zip"}
case "$OUTPUT_PATH" in
  /*) ;;
  *) OUTPUT_PATH="$PROJECT_ROOT/$OUTPUT_PATH" ;;
esac
STAGING_DIR=$(mktemp -d "${TMPDIR:-/tmp}/foundly-lambda.XXXXXX")
trap 'rm -rf "$STAGING_DIR"' EXIT HUP INT TERM

mkdir -p "$STAGING_DIR/backend" "$(dirname -- "$OUTPUT_PATH")"

if [ ! -f "$PROJECT_ROOT/backend/lambda.js" ] || [ ! -f "$PROJECT_ROOT/backend/src/http-routes.js" ] || [ ! -f "$PROJECT_ROOT/backend/src/services/matching-engine.js" ]; then
  printf '%s\n' "Missing Lambda runtime source under backend/" >&2
  exit 1
fi

cp "$PROJECT_ROOT/backend/lambda.js" "$STAGING_DIR/backend/lambda.js"
# backend/src is the complete application runtime tree. It intentionally does
# not include the browser frontend tree or local/sample data.
cp -R "$PROJECT_ROOT/backend/src" "$STAGING_DIR/backend/src"
cp "$PROJECT_ROOT/package.json" "$STAGING_DIR/package.json"
if [ -f "$PROJECT_ROOT/package-lock.json" ]; then cp "$PROJECT_ROOT/package-lock.json" "$STAGING_DIR/package-lock.json"; fi

# Install only runtime dependencies into the staging directory. This command
# is intentionally not run by Phase 11F; it is for an approved local package
# build and never reads credentials from project files.
npm install --omit=dev --ignore-scripts --prefix "$STAGING_DIR"

rm -f "$OUTPUT_PATH"
if [ -f "$STAGING_DIR/package-lock.json" ]; then
  (CDPATH= cd -- "$STAGING_DIR" && zip -qr "$OUTPUT_PATH" backend package.json package-lock.json node_modules)
else
  (CDPATH= cd -- "$STAGING_DIR" && zip -qr "$OUTPUT_PATH" backend package.json node_modules)
fi
printf '%s\n' "Created $OUTPUT_PATH"
