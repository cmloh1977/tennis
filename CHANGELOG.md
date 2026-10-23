# Changelog

## v1.7 — 2026-10-23

### Updates arrive complete
- Each new version is now downloaded as one complete set. The phone only switches to it once every file has arrived, so old and new files can no longer get mixed (in v1.6 this left the Camera check buttons not working until the app was reopened).
- The app no longer downloads anything in the background each time it opens; it only downloads when there is a new version.
- The 18 MB body tracker is kept between versions, so it isn't downloaded again with every update.

### Camera test: joints shown
- White dots on the elbows, wrists, knees and ankles, so a straight arm no longer looks like one long stick.
- The **hitting wrist** (right wrist, or left if left-handed) is a big **cyan** dot, so you can check it is followed during a fast swing.

## v1.6 — 2026-10-23

### Camera check: see what the camera saw (step 2a of [Issue #4](https://github.com/cmloh1977/tennis/issues/4))
- New **Camera check** switch in Settings (default Off). When On, Return and Volley sessions turn on the front camera at Start. The screen and cues look exactly as before.
- After each cue the app watches for 2.5 s, then shows a **result screen** for 3 s (white text on black, no frame), for example: "Cue: forehand wide · Moved: right, big (1.6) · Forward/back: closer 12%".
- Sideways moves are measured in shoulder widths from where your hips were just before the cue: under 0.25 = stayed, 1.0 or more = big, in between = small. "Same" means less than 8% closer or further.
- No pass / fail yet: compare the result with what you did, so the limits can be tuned. Swing and "back home" time come next (step 2b).
- Return + Rally keeps the camera off.

## v1.5 — 2026-10-22

### Camera test (step 1 of [Issue #4](https://github.com/cmloh1977/tennis/issues/4))
- New **Camera test** button on the Home screen. It turns on the front camera and draws a thick yellow **stick figure** over you, with a white dot on your hips.
- A readout shows how many pictures per second are tracked, whether the picture is upright or sideways, whether you were found, and warns **"Hips: near the edge!"** when you are about to leave the picture. Use it to choose between holding the phone upright or sideways.
- **Done** switches the camera off. The picture stays on the phone; nothing is recorded or sent.
- Uses Google's MediaPipe body tracker (version 1.0.1), stored in the app so it also works offline. It adds about 18 MB, saved on the phone the first time the new version opens.
- Training sessions are unchanged.

## v1.4 — 2026-10-22

### White frame with each cue (follow-up to [Issue #3](https://github.com/cmloh1977/tennis/issues/3))
- A thick white frame now appears around the edge of the screen together with the triangles, so the cue stands out more from the black waiting screen. The waiting screen stays pure black.
- The triangles are a little narrower on a phone held upright (about 7%), so a black gap separates them from the frame.

## v1.3 — 2026-10-22

### Black screen with a white arrow for all cues ([Issue #3](https://github.com/cmloh1977/tennis/issues/3))
- Forehand and backhand cues are now a **black screen with white triangles**; the direction of the triangles shows the side. No more green / red backgrounds.
- Triangles, wide / body, short / deep tilt, handedness, voice and timing are unchanged.
- Green and red are now free for the v2 pass / fail screens.

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
