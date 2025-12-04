#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
OUT_DIR="$ROOT_DIR/release-ext"

echo "Cleaning $OUT_DIR ..."
rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$OUT_DIR/dist" "$OUT_DIR/css" "$OUT_DIR/js" "$OUT_DIR/vendor" "$OUT_DIR/vendor/phosphor-icons"

echo "Copying core files ..."
cp "$ROOT_DIR/manifest.json" "$OUT_DIR/"
cp "$ROOT_DIR/index.html" "$OUT_DIR/"
cp "$ROOT_DIR/favicon.png" "$OUT_DIR/" || true
cp "$ROOT_DIR/dist/app.css" "$OUT_DIR/dist/"
cp "$ROOT_DIR/css/style.css" "$OUT_DIR/css/"
cp "$ROOT_DIR/js/app.js" "$OUT_DIR/js/"

echo "Copying vendor libs ..."
cp "$ROOT_DIR/vendor/js-yaml.min.js" "$OUT_DIR/vendor/"
cp "$ROOT_DIR/vendor/Sortable.min.js" "$OUT_DIR/vendor/"

echo "Copying Phosphor icon fonts (woff2 only) ..."
for w in regular thin light bold fill duotone; do
  src_dir="$ROOT_DIR/vendor/phosphor-icons/$w"
  dst_dir="$OUT_DIR/vendor/phosphor-icons/$w"
  mkdir -p "$dst_dir"
  # CSS
  cp "$src_dir/style.css" "$dst_dir/"
  # WOFF2 font only
  woff2=$(ls "$src_dir"/*.woff2 2>/dev/null || true)
  if [ -n "$woff2" ]; then
    cp $woff2 "$dst_dir/"
  fi
done

echo "Release directory ready: $OUT_DIR"
