# Tennis Reaction Trainer

Random forehand/backhand cues for shadow-swing practice, so you react instead of planning your next stroke. Place your iPhone or iPad a few metres in front of you and tap **Start**.

**Open it:** https://cmloh1977.github.io/tennis/ (in Chrome or Safari)

## Cues
- **Forehand:** green screen with a big arrow (points right for right-handers).
- **Backhand:** red screen with a big arrow (points left for right-handers).
- A voice says **"wide"** or **"body"** at the same moment.

Each rep: black screen → random 3–5 s wait → **beep** (split-step) → cue.

## Modes
- **Return:** single return-of-serve reps.
- **Volley:** the cue comes sooner after the beep (60% of the normal gap).
- **Return + Rally:** after the return, a **tick** then a new cue every few seconds, until a white **STOP** screen (after 2–8 shots).

## Settings
Handedness, difficulty (beep-to-cue gap), rally tempo, forehand/backhand balance, wide/body mix, reps per set, sets, rest between sets, and a sound/screen sync fine-tune. They are saved on your phone.

## iPhone / iPad tips
- **Add to Home Screen** (Share → Add to Home Screen) for a full-screen app that also works offline.
- **No sound?** The silent switch may mute the app. Turn ringer mode on and the volume up.
- **Screen turning off?** The app keeps the screen awake during a session. If it still turns off, set Auto-Lock to a longer time.
- **Sunlight:** turn screen brightness all the way up.
- **Updates:** when a new version is published, close and reopen the app twice to get it. The version number is shown at the bottom of the home screen.

## For development
- Plain HTML, CSS and JavaScript, no build step. See `CLAUDE.md` for the full project description.
- Run locally: `python3 -m http.server 8000`, then open http://localhost:8000. Add `?fast=1` to shorten the waits for quick testing.
- `tools/make-audio.sh` rebuilds the voice clips (pass a voice name, e.g. `Daniel`).
- `tools/make-icons.py` redraws the icons; `tools/make-keepawake-video.swift` rebuilds the keep-awake video.
