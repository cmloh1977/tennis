# Changelog

## v1.2 — 2026-10-22

### Wide / body on screen, and a Voice switch ([Issue #2](https://github.com/cmloh1977/tennis/issues/2))
- The arrow is replaced by fast-forward style triangles: **two triangles (▶︎▶︎) = wide**, **one triangle (▶︎) = body**. Body and wide use exactly the same triangle shape and size.
- Colours are unchanged (forehand green, backhand red). Left-handed still swaps left and right.
- Short / deep still works: the triangles tilt up (short) or down (deep).
- New **Voice ("wide" / "body")** switch in Settings (default On). Off = triangles only, no voice; the beep and tick still play. Saved on the phone and restored by "Reset to defaults".
- With Voice off, the gap from beep to cue stays exactly as set.

## v1.1 — 2026-10-22

### Short / deep cues ([Issue #1](https://github.com/cmloh1977/tennis/issues/1))
- New **Short / deep cues** switch in Settings (default Off). When On, the arrow tilts up for a short ball (move forward) or down for a deep ball (move back): forehand ↗ / ↘, backhand ↖ / ↙.
- New **Short / deep** slider (0–100% deep, default 50%), shown only when the switch is On.
- Works in all modes. The voice still says only "wide" or "body". Left-handed swaps left and right; up and down stay the same.
- The tilted arrow is drawn as wide as the flat one, so it still reads from a few metres away.
- With the switch Off, cues look exactly like v1.0.

## v1.0 — 2026-10-21

First full version, live at https://cmloh1977.github.io/tennis/.

### Cues
- Forehand: full green screen with a big arrow. Backhand: full red screen with a big arrow.
- The voice says "wide" or "body" at the same moment as the screen changes. It uses pre-recorded clips played through Web Audio, adjusted for the phone's speaker delay.
- Handedness setting flips the arrow direction for left-handers.

### Modes
- **Return:** random 3–5 s wait → beep (split-step) → cue.
- **Volley:** the same, with a shorter beep-to-cue gap (60%).
- **Return + Rally:** after the return, a tick and a new cue every few seconds, ending after 2–8 shots with a white STOP screen.

### Settings (saved on the phone)
- Difficulty, rally tempo, forehand/backhand balance, wide/body mix, reps per set, sets, rest between sets, handedness, sound/screen sync fine-tune.
- Rest countdown between sets, with a beep 3 s before the next set.
- The last-used mode is remembered.

### iPhone / iPad
- Big Start button (iPhone only plays sound after a tap).
- The screen stays awake during a session (wake lock, with a silent-video backup).
- Add to Home Screen as a full-screen app with a tennis-ball icon.
- Works offline once opened.
- "iPhone tips" section on the home screen (silent switch, Add to Home Screen, Auto-Lock, brightness).

### Earlier test versions
- 0.1: hello page to check the secure GitHub Pages address.
- 0.2: Return mode. 0.2.1: random wait shortened from 3–7 s to 3–5 s.
- 0.3: Volley and Return + Rally modes.
- 0.4: Settings screen, sets and rest.
