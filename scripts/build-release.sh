#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/release-ext"
VERSION=$(node -p "require('./package.json').version")
COMMIT=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")
ZIP_NAME="release-ext-${VERSION}.zip"
ZIP_PATH="$ROOT_DIR/$ZIP_NAME"

echo "Cleaning output directories ..."
rm -rf "$OUT_DIR" "$ZIP_PATH"
mkdir -p "$OUT_DIR"

echo "Copying project files ..."
cp "$ROOT_DIR/manifest.json" "$OUT_DIR/"
cp "$ROOT_DIR/index.html" "$OUT_DIR/"
cp "$ROOT_DIR/options.html" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/options.js" "$OUT_DIR/" 2>/dev/null || true
cp "$ROOT_DIR/favicon.png" "$OUT_DIR/" 2>/dev/null || true

cp -R "$ROOT_DIR/css" "$OUT_DIR/"
cp -R "$ROOT_DIR/dist" "$OUT_DIR/"
cp -R "$ROOT_DIR/js" "$OUT_DIR/"
cp -R "$ROOT_DIR/vendor" "$OUT_DIR/"

cat <<EOF > "$OUT_DIR/version.txt"
version: $VERSION
commit: $COMMIT
built: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

find "$OUT_DIR" -name '.DS_Store' -delete 2>/dev/null || true

echo "Creating archive $ZIP_NAME ..."
(cd "$OUT_DIR" && zip -rq "$ZIP_PATH" .)

echo "Release ready: $OUT_DIR"
echo "Archive created at: $ZIP_PATH"
