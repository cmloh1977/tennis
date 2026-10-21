"""Cut the silence from the start of a 16-bit mono WAV file, so the word plays the instant it starts.

Usage: python3 trim_silence.py in.wav out.wav
"""
import array
import sys
import wave

THRESHOLD = 500      # sample level (out of 32767) that counts as "sound"
KEEP_BEFORE_MS = 5   # keep a tiny bit before the first sound so it doesn't click
FADE_OUT_MS = 10     # short fade at the end to avoid a click

src, dst = sys.argv[1], sys.argv[2]
with wave.open(src, "rb") as w:
    params = w.getparams()
    samples = array.array("h", w.readframes(w.getnframes()))

rate = params.framerate
first = next((i for i, s in enumerate(samples) if abs(s) > THRESHOLD), 0)
last = max((i for i, s in enumerate(samples) if abs(s) > THRESHOLD), default=len(samples) - 1)
start = max(0, first - rate * KEEP_BEFORE_MS // 1000)
trimmed = samples[start:last + 1]

fade = min(len(trimmed), rate * FADE_OUT_MS // 1000)
for i in range(fade):
    idx = len(trimmed) - fade + i
    trimmed[idx] = int(trimmed[idx] * (1 - i / fade))

with wave.open(dst, "wb") as w:
    w.setparams(params)
    w.writeframes(trimmed.tobytes())

print(f"{dst}: cut {start * 1000 // rate} ms of silence, {len(trimmed) * 1000 // rate} ms long")
