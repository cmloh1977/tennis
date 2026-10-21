#!/bin/sh
# Rebuilds the voice clips in audio/ using the Mac's built-in voice.
# To try another voice, list them with: say -v '?'
# Then run: sh tools/make-audio.sh Daniel
set -e
VOICE="${1:-Samantha}"
cd "$(dirname "$0")/.."
mkdir -p audio
TMP="$(mktemp -d)"

for WORD in wide body; do
  say -v "$VOICE" -r 220 -o "$TMP/$WORD.aiff" "$WORD"
  afconvert -f WAVE -d LEI16@44100 -c 1 "$TMP/$WORD.aiff" "$TMP/$WORD.wav"
  python3 tools/trim_silence.py "$TMP/$WORD.wav" "audio/$WORD.wav"
done

rm -rf "$TMP"
