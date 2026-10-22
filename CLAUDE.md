# Tennis Reaction Trainer

A web app for shadow-swing practice. It gives random cues so the player reacts instead of planning the next stroke. Used outdoors on a rooftop, with an iPhone or iPad placed a few metres in front of the player.

Current version: **1.0** (see `CHANGELOG.md`). Live at **https://cmloh1977.github.io/tennis/**.

## Working style (important)

- The user is new to Claude Code. Explain what you're doing in plain language, without jargon (or explain the jargon briefly).
- Keep changes small and focused. One feature or fix at a time.
- **Always propose a plan and wait for approval before building a new feature.**
- Build in small steps and stop after each one so the user can test it on their phone before continuing.
- After a change, say how to try it out (e.g. which file to open, what to tap).

## Platform and tech

- Single-page web app for iPhone/iPad. **Main browser: Chrome. Must also work in Safari.**
- On iPhone/iPad, Chrome uses the same engine as Safari (WebKit), so iOS limits on sound and the screen also apply in Chrome. Don't rely on features that only work in desktop/Android Chrome.
- Installable to the home screen as a **PWA** (web app manifest + service worker so it works offline). Installing from Chrome and from Safari should both work.
- Hosted on **GitHub Pages**, so it must be purely static files with relative paths (no server code, no build step).
- **Plain HTML, CSS and JavaScript only.** No frameworks, no npm packages, no bundlers. The helper scripts in `tools/` use only what comes with macOS (Python standard library, `say`, `afconvert`, Swift).

When changing the app:
- Bump the version number at the bottom of the home screen (`index.html`) so the user can tell which version their phone has, and add an entry to `CHANGELOG.md`.
- Any new file the app needs must be added to the `FILES` list in `sw.js`, or it won't work offline.
- `sw.js` serves the saved copy first and updates in the background, so a new version shows on the second open after publishing.

File layout (keep it this small unless there's a good reason):

```
index.html        page structure: Home, Settings and Session screens
style.css         styling
app.js            all app logic
manifest.json     PWA manifest
sw.js             service worker (offline caching)
audio/            pre-recorded voice clips ("wide", "body"); beep and tick are generated tones
media/            keepawake.mp4 (backup for keeping the screen on)
icons/            home-screen icons (tennis ball on black)
tools/            scripts that rebuild the audio, icons and video
docs/             notes for the user (not used by the app)
.claude/launch.json   local test server (python3 -m http.server 8000)
```

## Hosting, git and publishing

- GitHub repository: **cmloh1977/tennis** (public, because free GitHub Pages needs that). Pages serves the `main` branch from the root folder.
- The GitHub command-line tool `gh` is installed and logged in as `cmloh1977`; use it for repository and Pages tasks.
- Git identity for this project only (local config): name `cmloh1977`, email `238814793+cmloh1977@users.noreply.github.com` (GitHub's private noreply address, so the real email stays hidden).
- Publishing = commit, `git push`, then wait until the live page shows the new version number. Don't rely on the HTTP status code: GitHub's "Site not found" page also returns 200. GitHub may cache pages for up to 10 minutes.
- `.claude/settings.local.json` is personal and stays out of git (`.gitignore`).

## Cues

All parts of a cue (colour, arrow, voice) fire at **the same instant**.

| Shot     | Screen colour     | Arrow (right-handed) |
|----------|-------------------|----------------------|
| Forehand | full-screen green (`#00c400`) | big arrow pointing right |
| Backhand | full-screen red (`#e00000`)   | big arrow pointing left  |

- The arrow is a chunky white SVG filling most of the screen (chosen so it reads from a few metres away with the phone upright).
- A voice says **"wide"** or **"body"** at the same moment the screen changes.
- **Handedness** setting (default: right-handed). Left-handed flips the arrow directions; colours stay the same (forehand is always green).
- Must be readable in **bright sunlight**: highly saturated colours, a huge arrow, high contrast. No subtle greys or thin lines.
- The neutral screen is black. The status text ("Set 1/3 · Rep 4/10", top left) and the End button (top right) are hidden during cues.

### Audio sync (key technical requirement)

Voice and visual must be in sync, so audio latency must be minimal:
- Use **pre-recorded audio files**, not the browser's speech synthesis (it has a noticeable, variable delay).
- Voice clips are made with the Mac voice **Samantha** (`tools/make-audio.sh`), saved as 16-bit mono 44.1 kHz WAV, with leading silence trimmed (`tools/trim_silence.py`).
- Load and decode all sounds at Start with the **Web Audio API** (`AudioContext` + `AudioBuffer`), not `<audio>` elements, which lag on iOS.
- Beep (1000 Hz, 0.12 s) and tick (2000 Hz, 0.04 s) are generated with a Web Audio oscillator, so no files are needed.
- `showCue()` starts the voice and changes the screen together. It holds the screen change back by the speaker delay the phone reports (`outputLatency`/`baseLatency`), plus the user's sync fine-tune.
- `navigator.audioSession.type = 'playback'` is set where supported, so sound can play even with the silent switch on.

## Each rep

1. Neutral (black) screen.
2. Random wait (**3–5 s**, the user found 3–7 s too long) so the rhythm can't be predicted.
3. Short **beep** = split-step trigger.
4. Gap (set by difficulty), then the **cue** (colour + arrow + voice), shown for 1.5 s.

## Modes

1. **Return** – single return-of-serve reps.
2. **Volley** – same cues as Return, but the beep-to-cue gap is **60%** of the difficulty setting (balls arrive faster at the net).
3. **Return + Rally** – the return cue counts as shot 1. After it, a new cue every rally-tempo interval (tempo ± 0.5 s at random), each preceded by a **tick 0.5 s before** the cue. The screen goes back to neutral between rally cues so two same-side cues still look separate. Each cue is randomly forehand/backhand and wide/body. The rally ends after a random 2–8 shots with a white **"STOP"** screen for 2 s.

The last-used mode is remembered.

## Settings

| Setting | Range | Default |
|---|---|---|
| Handedness | Right / Left | Right |
| Difficulty (beep → cue gap) | 0.30 – 1.20 s | 0.70 s |
| Rally tempo | 1.5 – 4 s | 2.5 s |
| Forehand / backhand | 0 – 100% backhand | 50% |
| Wide / body | 0 – 100% wide | 50% |
| Reps per set | 1 – 30 | 10 |
| Sets | 1 – 10 | 3 |
| Rest between sets | 10 s – 3 min | 1 min |
| Sound / screen sync | −150 to +150 ms | 0 |

- Defined in `DEFAULT_SETTINGS` and `SLIDERS` in `app.js`. Fixed timings (wait range, cue length, volley factor, tick lead, rally shot range, STOP length) are in `TIMING`.
- Saved in `localStorage` under `tennis-trainer-v1` (settings + mode), wrapped in try/catch. "Reset to defaults" button.
- Between sets: big countdown on a black screen, beep 3 s before the next set.

## iPhone / iPad requirements (Chrome and Safari)

- A **big Start button**: iOS only allows sound to play after the user taps something. The `AudioContext` is created/unlocked inside that tap.
- **Keep the screen awake** during a session: first the Screen Wake Lock API, requested at the very start of the Start tap and again when the page becomes visible; if that fails, a tiny silent looping video (`media/keepawake.mp4`, muted, playsinline). The "iPhone tips" section shows which method was used.
- `sw.js` answers video range requests from the saved copy, so the backup video also works offline.
- Large touch targets for everything; the user may be tapping with sweaty hands or from a distance.
- The home screen has a collapsible **"iPhone tips"** section: silent switch, Add to Home Screen, Auto-Lock, brightness.

## Testing

- Test on a real iPhone/iPad, in **Chrome first, then Safari**. Desktop browsers don't reproduce iOS audio and wake-lock behaviour exactly.
- Before publishing, check changes on the Mac in the built-in browser using the local server (`.claude/launch.json`, http://localhost:8000). Add **`?fast=1`** to the address to shorten the waits (reaction gaps stay real).
- Because of the service worker, reload twice locally to see changes.
- If a feature (e.g. keeping the screen awake) works in one browser but not the other, say so and suggest a fallback.
- The phone can also open the Mac's local server over Wi-Fi (http://192.168.1.17:8000), but keep-awake and offline mode only work on the https GitHub Pages address.
