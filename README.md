# Tennis Reaction Trainer

Random forehand/backhand cues for shadow-swing practice, so you react instead of planning your next stroke. Place your iPhone or iPad a few metres in front of you and tap **Start**.

**Open it:** https://cmloh1977.github.io/tennis/ (in Chrome or Safari)

## Cues
- **Forehand:** white triangles on black pointing right (for right-handers), with a white frame around the screen.
- **Backhand:** the same, pointing left.
- **Wide:** two triangles (▶︎▶︎). **Body:** one triangle (▶︎).
- A voice says **"wide"** or **"body"** at the same moment (can be switched off).

Each rep: black screen → random 3–5 s wait → **beep** (split-step) → cue.

## Modes
- **Return:** single return-of-serve reps.
- **Volley:** the cue comes sooner after the beep (60% of the normal gap).
- **Return + Rally:** after the return, a **tick** then a new cue every few seconds, until a white **STOP** screen (after 2–8 shots).

## Camera check (Return and Volley)
Turn on **Camera check** in Settings and place the phone **sideways** a few metres away (check the framing with **Camera test**). After each cue the front camera judges your response:
- **Green screen with your time** (from the cue until you're back home): you stepped the right way (wide = toward the ball, body = a small step away to make room), swung the right stroke, and were back within 4 s.
- **Red screen with the reason:** WRONG WAY, NO STEP, WRONG SWING, NO SWING or NOT BACK.
- After the session a results list shows every rep and a summary. Nothing is recorded or sent anywhere; the tracking runs on the phone.
- **Tuning test** on the Home screen runs 8 fixed reps (4 correct moves, 4 deliberate mistakes) to check the camera readings.

## Settings
Handedness, camera check, difficulty (beep-to-cue gap), rally tempo, forehand/backhand balance, voice on/off, wide/body mix, reps per set, sets, rest between sets, and a sound/screen sync fine-tune. They are saved on your phone.

## iPhone / iPad tips
- **Add to Home Screen** (Share → Add to Home Screen) for a full-screen app that also works offline.
- **No sound?** The silent switch may mute the app. Turn ringer mode on and the volume up.
- **Screen turning off?** The app keeps the screen awake during a session. If it still turns off, set Auto-Lock to a longer time.
- **Sunlight:** turn screen brightness all the way up.
- **Updates:** when a new version is published, close and reopen the app twice to get it. The version number is shown at the bottom of the home screen.

## For development
- Plain HTML, CSS and JavaScript, no build step, plus Google's MediaPipe pose tracker stored in `vendor/mediapipe/` (`tools/get-mediapipe.sh`). See `CLAUDE.md` for the full project description.
- Run locally: `python3 -m http.server 8000`, then open http://localhost:8000. Add `?fast=1` to shorten the waits for quick testing.
- `tools/make-audio.sh` rebuilds the voice clips (pass a voice name, e.g. `Daniel`).
- `tools/make-icons.py` redraws the icons; `tools/make-keepawake-video.swift` rebuilds the keep-awake video.
