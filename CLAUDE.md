# Tennis Reaction Trainer

A web app for shadow-swing practice. It gives random cues so the player reacts instead of planning the next stroke. Used outdoors on a rooftop, with an iPhone or iPad placed a few metres in front of the player.

Current version: **2.7** (see `CHANGELOG.md`). Live at **https://cmloh1977.github.io/tennis/**.

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
- **Plain HTML, CSS and JavaScript only.** No frameworks, no npm packages, no bundlers. **One exception (Issue #4):** the MediaPipe pose tracker (`@mediapipe/tasks-vision`, pinned at 1.0.1) for the camera check. Its files are copied into `vendor/mediapipe/` by `tools/get-mediapipe.sh` (not loaded from the internet) and loaded only when the camera is used. The helper scripts in `tools/` use only what comes with macOS (Python standard library, `say`, `afconvert`, Swift).

When changing the app:
- Bump the version number at the bottom of the home screen (`index.html`) **and `VERSION` in `sw.js`** (same number; without it phones don't notice the update), and add an entry to `CHANGELOG.md`.
- Any new file the app needs must be added to the `FILES` list in `sw.js`, or it won't work offline.
- `sw.js` (since v1.7) saves each version as one complete cache, `tennis-trainer-<VERSION>`, downloaded with `?v=<VERSION>` so GitHub's cache can't hand back an old copy. The new version is only used once every file has arrived; then older caches are deleted. Files are always served from the cache (no background refresh), so old and new files can't mix. A new version shows on the second open after publishing.
- The MediaPipe files live in their own cache, `tennis-mediapipe-1.0.1` (`TRACKER_FILES`), kept between app versions. If the tracker version changes, rename that cache.

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
vendor/mediapipe/ pose tracker for the camera (library, engine, "lite" model; ~18 MB)
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

All parts of a cue (triangles + white frame appearing, voice) fire at **the same instant**.

| Shot     | Screen | Direction (right-handed) |
|----------|--------|--------------------------|
| Forehand | black, white triangles, white frame | triangles pointing right |
| Backhand | black, white triangles, white frame | triangles pointing left  |

Since v1.3 cues have no background colour (Issue #3): the triangles appearing on the black screen is the signal. Since v1.4 a thick white frame (inset `box-shadow`, 4vmin) appears around the screen edge with every cue, so the change is easier to catch in sunlight. Green and red are used only for the Camera check's pass / fail screens (v2.0).

| Placement | Sign (fast-forward style) | Voice |
|-----------|---------------------------|-------|
| Wide      | two triangles in a row ▶︎▶︎ | "wide" |
| Body      | one triangle ▶︎, centred    | "body" |

- The triangles are solid white SVG shapes (`#arrow` / `#arrow-shape` in `index.html`; `.body-shape` and `.wide-shape`, switched by the `wide` class). **Body and wide use exactly the same triangle shape and size** (the user asked for this); the wide sign fills the screen width minus a black gap inside the white frame (`#arrow` width `calc(100vw - 16vmin)`), so each triangle is slim (46 × 100 in a 100 × 100 frame).
- A voice says **"wide"** or **"body"** at the same moment the screen changes. In `app.js` this is the shot's `placement`. The **Voice** setting (default On) can turn the voice off, leaving triangles only; beep and tick still play.
- **Handedness** setting (default: right-handed). Left-handed flips the directions.
- **Short / deep cues were removed in v1.12** (the user wanted it simpler; the feet/body-length depth reading was also unreliable). Cues are always flat: 4 cues. The old code is in git history (v1.1–v1.11) if it's ever wanted back.
- Must be readable in **bright sunlight**: pure white on black, huge shapes, high contrast. No subtle greys or thin lines.
- The neutral screen is black. The status text ("Set 1/3 · Rep 4/10", top left) and the End button (top right) are hidden during cues.

### Audio sync (key technical requirement)

Voice and visual must be in sync, so audio latency must be minimal:
- Use **pre-recorded audio files**, not the browser's speech synthesis (it has a noticeable, variable delay).
- Voice clips are made with the Mac voice **Samantha** (`tools/make-audio.sh`), saved as 16-bit mono 44.1 kHz WAV, with leading silence trimmed (`tools/trim_silence.py`).
- Load and decode all sounds at Start with the **Web Audio API** (`AudioContext` + `AudioBuffer`), not `<audio>` elements, which lag on iOS.
- Beep (1000 Hz, 0.12 s) and tick (2000 Hz, 0.04 s) are generated with a Web Audio oscillator, so no files are needed.
- `showCue()` starts the voice and changes the screen together. It holds the screen change back by the speaker delay the phone reports (`outputLatency`/`baseLatency`), plus the user's sync fine-tune. With Voice off it still holds the screen back, because the beep reaches the ear late by the same delay; this keeps the beep-to-cue gap as set.
- `navigator.audioSession.type = 'playback'` is set where supported, so sound can play even with the silent switch on.

## Each rep

1. Neutral (black) screen.
2. Random wait (**3–5 s**, the user found 3–7 s too long) so the rhythm can't be predicted.
3. Short **beep** = split-step trigger.
4. Gap (set by difficulty), then the **cue** (triangles + voice), shown for 1.5 s.

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
| Voice ("wide" / "body") | Off / On | On |
| Reps per set | 1 – 30 | 10 |
| Sets | 1 – 10 | 3 |
| Rest between sets | 10 s – 3 min | 1 min |
| Sound / screen sync | −150 to +150 ms | 0 |
| Camera check (Return / Volley) | Off / On | Off |
| Result → next serve (shown only with Camera check) | 0.5 – 5 s | 1.2 s |

- Defined in `DEFAULT_SETTINGS` and `SLIDERS` in `app.js`. Fixed timings (wait range, cue length, volley factor, tick lead, rally shot range, STOP length) are in `TIMING`.
- Saved in `localStorage` under `tennis-trainer-v1` (settings + mode), wrapped in try/catch. "Reset to defaults" button.
- Between sets: big countdown on a black screen, beep 3 s before the next set.

## iPhone / iPad requirements (Chrome and Safari)

- A **big Start button**: iOS only allows sound to play after the user taps something. The `AudioContext` is created/unlocked inside that tap.
- **Keep the screen awake** during a session: first the Screen Wake Lock API, requested at the very start of the Start tap and again when the page becomes visible; if that fails, a tiny silent looping video (`media/keepawake.mp4`, muted, playsinline). The "iPhone tips" section shows which method was used.
- `sw.js` answers video range requests from the saved copy, so the backup video also works offline.
- Large touch targets for everything; the user may be tapping with sweaty hands or from a distance.
- The home screen has a collapsible **"iPhone tips"** section: silent switch, Add to Home Screen, Auto-Lock, brightness.

## Camera (Issue #4)

### Camera test (step 1)

- **Camera test** button on Home opens `#camera-screen`: front camera (`getUserMedia`, `facingMode: 'user'`), mirrored, with a stick figure drawn on a `<canvas>` (the camera picture is drawn there too; the `<video>` plays out of sight). `object-fit: contain` shows the whole camera picture.
- `loadPose()` in `app.js` imports `vendor/mediapipe/vision_bundle.mjs` on first use and makes a `PoseLandmarker` (GPU, CPU fallback, `runningMode: 'VIDEO'`, one person). `trackFrame()` runs each screen refresh; the readout (fps, upright/sideways, hips near edge) updates twice a second.
- Only the SIMD engine (`vision_wasm_internal.*`) is shipped; it needs iOS 16.4 or newer.
- The camera only works on https (the GitHub Pages address) or on localhost. The built-in browser pane on the Mac blocks the camera, so test the drawing there with a fake stream (`canvas.captureStream()`).
- The stick figure has white joint dots (elbows, wrists, knees, ankles) and a big cyan dot on the hitting wrist (from the Handedness setting).
- `startCamera()` / `stopCamera()` are shared by the Camera test and the Camera check; `cameraUse` says which one is running (`'test'` draws, `'session'` only records).

### Camera check (step 2a, v1.6)
- **Camera check** setting (default Off). On = Return and Volley sessions start the camera in the Start tap (Rally never does). If the camera fails, Start stops with a message.
- `trackFrame()` → `recordSample()` keeps the last 10 s of body positions (hips, chest centre, hitting wrist, shoulder width, in pixels). `showCue()` sets `cueShownAt` in its paint step.
- After the cue, `showCheck()` checks `analyseRep(cueShownAt, now)` every 0.1 s and shows the `result` screen (`describeResult()`, 3 s, plain text on black, **no white frame**) as soon as `homeAt` is found, or at `maxWatchSeconds` (6 s; the user found the old fixed 2.5 s came before the end of the swing). The start spot = hips averaged over the 0.5 s before the cue.
- Sideways = furthest hip move in **shoulder widths** (distance-independent), toward the player's own right/left; which way is "right" in the picture comes from the shoulders, so camera mirroring doesn't matter.
- All limits are in `CAMERA` in `app.js`. No pass/fail yet: we tune them from Tuning test results (see below).
- On the Mac the camera is blocked and the hidden pane pauses `requestAnimationFrame`: test with a fake `getUserMedia` (`canvas.captureStream()`), a fake `poseTracker.detectForVideo` that moves a body after `cueShownAt`, and `requestAnimationFrame` swapped for `setTimeout`.

### Swing and back home (step 2b, v1.8)
- Each sample also keeps the hitting wrist (from Handedness) and the chest centre. `findSweeps()` lists the wrist sweeps that cross the chest centre; `pickSwing()` chooses one (see Rounds 2 and 3 below), `swingOf()` names it. From the hitting side = forehand, otherwise backhand. Its time is when the sweep completes.
- `findHome()`: first moment after the swing with hips within `homeDistance` (0.33 shoulder widths) sideways, held for `homeHoldSeconds` (0.2 s). Back-home time = that moment − `cueShownAt`. No swing = no time.
- In the fake-camera test, reset `cueShownAt = 0` between runs, or the fake player starts the next rep where the last one ended.

### Big result and results list (v1.10)
- The user couldn't read 6 small lines from a few metres in 3 s. During play `bigResult()` shows 2–3 huge lines for `resultSeconds` (5 s), `font-size: min(8.5vw, 11vh)`: STEP RIGHT / STEP LEFT / NO SIDE STEP, then FOREHAND / BACKHAND / NO SWING, then BACK IN x s / NOT BACK. Lines must stay under ~16 characters to fit a 375 px wide phone. Sideways and swing are on separate lines because "MOVED RIGHT BIG" + "FORWARD" once read like one thing.
- Every rep's full `describeResult()` text goes into `checkLog` (cleared at Start with Camera check). `endSession()` opens `#results-screen` (styled like Settings) when the log has entries; Home shows a **Last camera results** button until the next session.

### Tuning test and Copy results (v1.11)
- **Sideways (landscape) is the recommended camera setup**: the user found it gives more room for wide moves. Check camera screens in landscape first.
- **Tuning test** button (Home): `runSession(true)` runs `TUNING_REPS` (8 fixed shots, one set) with `tuningRep()`: an `instruction` screen ("DO: …", same big style as `result`) for 5 s, then `serveRep()` with the fixed shot, then `showCheck()` with the asked words. Always uses the camera. Reps 1–4 correct, 5–8 deliberate mistakes (wrong direction on a wide forehand, wrong swing, no step on a body forehand, stay out). Left-handed swaps the words LEFT/RIGHT (`tuningWords()`).
- `start(withCamera, tuning)` is shared by Start and Tuning test.
- Results list entries have an "Asked:" line in the Tuning test. **Copy results** copies the list plus `rawNumbers()` (side, swing sweep size and time, wrist reach R/L, closest home after the swing) for tuning `CAMERA`.
- **Round 1 (v1.11 → v1.12)**, sideways, right-handed. Small steps read 1.45–2.0, big 2.0–3.9, no step 0.0 → `bigMove` 2.2, `minMove` 0.5. Old swing rule (wrist ≥ 0.5 past the chest on both sides) missed all 3 wide forehands (left reach only 0.24–0.30) → `findSwing()` now takes the biggest sweep ≥ `swingTravel` 0.8 within 0.6 s. Body length (torso) read "closer" on nearly every rep, even step-back ones (bending/turning), so depth was dropped together with short/deep (v1.12). Back-home times 3.9–5.6 s → `maxWatchSeconds` 8. Left/right, backhands, wrong swing, no step and stay out all read correctly.
- The user can keep about 3 moves in mind at once; the "DO:" screen before each rep means nothing has to be memorised, and they just paste the copied results (no extra report needed).
- **Round 2 (v1.12 → v1.13)**, sideways, 8 reps: 7 of 8 correct. Real steps 1.55–3.1, no step 0.24; wrong direction, wrong swing, no step and stay out all caught. Only miss: rep 8 (stay out) read a forehand as backhand, because "biggest sweep" picked the arm coming back (+2.27). → `findSweeps()` lists every sweep that crosses the chest centre (starts ≥ `swingStart` 0.3 on one side, ends on the other, ≥ `swingTravel` 0.8 within 0.6 s); the **first** is the swing (`swingOf()`). Copy results lists all sweeps with times.
- **Round 3 (v1.13 → v1.14)**, 8 reps: rep 8 fixed, but both backhands (reps 2, 4) read as forehand: the backhand backswing crosses the body too (−1.15, −1.24) and came first; the real backhands were +2.69, +1.86. → `pickSwing()`: the biggest sweep, unless an earlier one is ≥ `swingEarlierShare` (0.8) of it. Backswings were 43–67% of the swing, rep 8's forehand 90% of the arm-back. Replayed on round 3's sweep lists: 8/8 correct. Margins are modest, so confirm with another round.
- **Round 4 (v1.14 → v1.15)**, 8 reps: 6/8. Forehands in reps 1 and 8 read as backhand: sweeps −1.24, **+1.92**, −2.02, +0.88 and −1.58, **+2.30**, −2.20, +1.25 — the backswing crossed the body and was nearly as big as the forehand. Size/order rules can't separate backswing, swing and recovery. → `pickSwing()` now takes the sweep with the biggest wrist **rise** (≥ `swingRise` 0.2; height = wrist above the shoulders in shoulder widths), falling back to the old rule. Copy results shows each sweep's rise, so other rules can be checked offline against the next round. Fallback idea if swing type stays unreliable: v2.0 judges step direction + "a swing happened" + back-home time only.
- **The user plays a one-handed backhand** (right-handed). The hitting (right) wrist does the whole backhand; its take-back crosses the body to the left.
- **What counts as correct (the user's rule):** the *direction* of the step, not its size. Wide = step toward the ball, any size (a small step on a wide ball is just a less wide ball, not a mistake). Body = a small step away to make room; no step on a body ball is a mistake. `bigMove` only labels big/small in the results list.
- Tuning process: user runs the Tuning test sideways, pastes the copied text, we set each limit between the correct reps (1–4) and the mistakes (5–8), explain the change, publish, and repeat until reps 1–4 read correctly and 5–8 are caught.

### Pass / fail (v2.0, issue #4 done)
- `judge(shot, result)` → `{ pass, reason }` in this order: no result → `pass: null` "CAN'T SEE YOU" (black `result` screen, not counted); NO STEP (under `minMove`); WRONG WAY (wide = toward the side the cue points to, body = the other way); NO SWING; WRONG SWING (`strokeSeen()` differs from the cue);; NOT BACK (no `homeAt` within `maxWatchSeconds`, **4 s**, the user's choice). Otherwise pass with time = `homeAt − cueShownAt`.
- **Swing judging since v2.2:** `strokeSeen(shot, result)`: the cue's stroke counts as seen if a sweep in its direction is ≥ `swingShare` (0.8) of the biggest sweep. A v2.1 session (10 wide forehands) showed the pattern run-lag (−) → **looped backswing** (+, rising 0.6–1.1) → flat forehand (−, rise −0.7..+0.6) → recovery (+), so the "biggest rise" rule (v1.15–v2.1, `pickSwing`, removed) called 7/10 backhand. Across all data, correct strokes' sweeps the cue's way were 86–100% of the biggest, deliberate wrong swings 53–65%. `swing` in `analyseRep()` is now just `{ at }` of the last big sweep (for NO SWING and for "back home only after the stroke").
- `start()` warns once if the camera picture is upright (`uprightWarnedAt`; a second tap within 60 s starts anyway). That v2.1 session said "upright picture" though the user held the phone sideways: likely Auto-rotate off on the Pixel, so the app and camera picture stayed upright; wide moves then left the picture (side 5.9 / 7.9, no swing).
- Screens: `pass` = green `#00c400`, black text, huge time (`.verdict-time`); `fail` = red `#e00000`, white reason word. Full colour, no white frame. Since v2.4 the user picks the time from card to next beep with the **Result → next serve** slider (`nextServeSeconds`, 0.5–5 s, default 1.2): half is the card (≤ `maxCardSeconds` 2 s), the rest the next rep's wait (`run.nextWait`, ± `waitSpread` 25%, via `run.afterCard`) instead of 3–5 s. History: card 4 s (v2.0) → 1 s + 1–2 s wait (v2.1) → 0.5 s + 0.5–1 s (v2.3); the user wants a quick rhythm. The first rep of a set keeps the normal wait.
- Results list: `resultsSummary()` on top ("x of y passed · average · best"), each entry starts with PASS / FAIL / Not judged and has a green / red edge. Copy results includes the summary.
- The Tuning test is judged too (reps 1–4 should be green, 5–8 red).
- **Rest screen progress (v2.5, table since v2.6):** `checkLog` entries keep `set` and `side`; `repStats()` gives right / wrong and average back-home times of the passes (overall, forehand cues, backhand cues, best). `rest()` shows `progressTable(setStats())` (Set ✓ ✗ Avg FH BH) in `#progress` under a small countdown (screen class `rest progress`, font sized in JS to fit up to 9 sets sideways) when the log has entries; the user wanted the numbers big and the countdown small. `setSummaries()` gives the same as text lines for the results list / Copy results (shown when there is more than one set).

## Opponent figure (issue #5, v3)

Built in 5 stages, each tested outdoors (phone ~3 m away, sunlight) before the next. See the issue for all stages.

- **Stage 1, Figure test (v2.7):** Home button opens `#figure-screen`; `drawFigure()` draws a white stick figure on a `<canvas>` serving on a loop (ready → toss → racket back → drop → hit → finish), always the same. The opponent faces the player and is right-handed, so its racket arm is on the player's left.
- Saved poses are in `POSES` (x across, y up, in figure heights; 1 = top of head); `SERVE_KEYS` says when each pose is reached; `poseAt()` slides between them (smoothstep). The toss is real gravity (`ballAt()`), landing on the racket at `HIT_AT`; the ball is hidden after the hit (flight comes in stage 2).
- Size, line thickness, head / ball size, speed and pause are in `FIGURE` in `app.js`. `size` covers the whole serve up to the toss (`FIGURE_TOP` 1.8 figure heights), so the body itself is about half the screen height.

## Testing

- Test on a real iPhone/iPad, in **Chrome first, then Safari**. Desktop browsers don't reproduce iOS audio and wake-lock behaviour exactly.
- Before publishing, check changes on the Mac in the built-in browser using the local server (`.claude/launch.json`, http://localhost:8000). Add **`?fast=1`** to the address to shorten the waits (reaction gaps stay real).
- Because of the service worker, reload twice locally to see changes.
- If a feature (e.g. keeping the screen awake) works in one browser but not the other, say so and suggest a fallback.
- The phone can also open the Mac's local server over Wi-Fi at `http://<Mac's address>:8000`, but keep-awake and offline mode only work on the https GitHub Pages address. The Mac's address changes with the network (it has been 192.168.1.17 and 10.63.233.146), so look it up with `ipconfig getifaddr en0` each time. On the Mac itself, use http://localhost:8000.
- Cue choices are purely random each rep (the user chose this over "shuffled deck" balancing), so a single set can come out lopsided.
