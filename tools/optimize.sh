#!/usr/bin/env bash
# Optimise every raw module export into public/models.
#
# gltf-transform's `optimize` takes one file at a time (`optimize <input> <output>`), so this
# loops rather than pointing it at a directory.
#
# --simplify false: the geometry is authored to a triangle budget already, and letting
# meshoptimizer decimate would quietly move surfaces the dimensional checks depend on.
#
# KTX2 texture compression needs the external `ktx` binary from KTX-Software. It is skipped when
# that is absent, so the pipeline runs on a clean machine; install KTX-Software once the AO bakes
# land and textures actually exist to compress.
set -euo pipefail

RAW_DIR=dist/raw
OUT_DIR=public/models

mkdir -p "$OUT_DIR"

shopt -s nullglob
files=("$RAW_DIR"/*.glb)
if [ ${#files[@]} -eq 0 ]; then
  echo "No .glb files in $RAW_DIR — run 'npm run export' first." >&2
  exit 1
fi

# The ${a[@]+"${a[@]}"} idiom below is needed because macOS ships bash 3.2, where expanding an
# empty array under `set -u` is an unbound-variable error.
texture_args=()
if command -v ktx >/dev/null 2>&1; then
  texture_args=(--texture-compress ktx2)
else
  echo "note: 'ktx' not found, skipping KTX2 texture compression."
  echo "      brew install ktx   (only needed once textures exist)"
fi

for src in "${files[@]}"; do
  name=$(basename "$src")
  npx --yes @gltf-transform/cli optimize "$src" "$OUT_DIR/$name" \
    --compress draco \
    --simplify false \
    ${texture_args[@]+"${texture_args[@]}"} \
    >/dev/null 2>&1
  printf '  %-20s %7s -> %7s bytes\n' "$name" \
    "$(stat -f%z "$src")" "$(stat -f%z "$OUT_DIR/$name")"
done

echo "Optimised ${#files[@]} module(s) into $OUT_DIR."
