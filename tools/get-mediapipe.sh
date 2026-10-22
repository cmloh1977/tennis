#!/bin/sh
# Downloads the MediaPipe pose tracker used by the Camera test into vendor/mediapipe/.
# The files are kept in the repo so the app works offline and never changes by
# surprise. Run from the project folder: sh tools/get-mediapipe.sh
set -e

VERSION=1.0.1   # pinned version of @mediapipe/tasks-vision
LIB="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@$VERSION"
MODEL="https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
OUT=vendor/mediapipe

mkdir -p "$OUT/wasm"
curl -fL "$LIB/vision_bundle.mjs" -o "$OUT/vision_bundle.mjs"
# Only the SIMD engine: every iPhone on iOS 16.4 or newer supports it.
curl -fL "$LIB/wasm/vision_wasm_internal.js" -o "$OUT/wasm/vision_wasm_internal.js"
curl -fL "$LIB/wasm/vision_wasm_internal.wasm" -o "$OUT/wasm/vision_wasm_internal.wasm"
curl -fL "$MODEL" -o "$OUT/pose_landmarker_lite.task"
# The library ends with a link to a debug file we don't ship; remove it.
sed -i '' '/sourceMappingURL/d' "$OUT/vision_bundle.mjs"
ls -l "$OUT" "$OUT/wasm"
