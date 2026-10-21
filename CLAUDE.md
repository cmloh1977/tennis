# Tennis Reaction Trainer

A web app for shadow-swing practice. It gives random cues so the player reacts instead of planning the next stroke. Used outdoors on a rooftop, with an iPhone or iPad placed a few metres in front of the player.

## Working style (important)

- The user is new to Claude Code. Explain what you're doing in plain language, without jargon (or explain the jargon briefly).
- Keep changes small and focused. One feature or fix at a time.
- **Always propose a plan and wait for approval before building a new feature.**
- After a change, say how to try it out (e.g. which file to open, what to tap).

## Platform and tech

- Single-page web app for iPhone/iPad. **Main browser: Chrome. Must also work in Safari.**
- On iPhone/iPad, Chrome uses the same engine as Safari (WebKit), so iOS limits on sound and the screen also apply in Chrome. Don't rely on features that only work in desktop/Android Chrome.
- Installable to the home screen as a **PWA** (web app manifest + service worker so it works offline). Installing from Chrome and from Safari should both work.
- Will be hosted on **GitHub Pages**, so it must be purely static files with relative paths (no server code, no build step).
- **Plain HTML, CSS and JavaScript only.** No frameworks, no npm packages, no bundlers.

Suggested file layout (keep it this small unless there's a good reason):

```
index.html        page structure
style.css         styling
app.js            all app logic
manifest.json     PWA manifest
sw.js             service worker (offline caching)
audio/            pre-recorded sounds (beep, tick, "wide", "body")
icons/            home-screen icons
```

## Cues

All parts of a cue (colour, arrow, voice) fire at **the same instant**.

| Shot     | Screen colour     | Arrow (right-handed) |
|----------|-------------------|----------------------|
| Forehand | full-screen green | big arrow pointing right |
| Backhand | full-screen red   | big arrow pointing left  |

- A voice says **"wide"** or **"body"** at the same moment the screen changes.
- **Handedness** setting (default: right-handed). Left-handed flips the arrow directions; colours stay the same (forehand is always green).
- Must be readable in **bright sunlight**: highly saturated colours, a huge arrow filling most of the screen, high contrast. No subtle greys or thin lines.

### Audio sync (key technical requirement)

Voice and visual must be in sync, so audio latency must be minimal:
- Use **pre-recorded audio files**, not the browser's speech synthesis (it has a noticeable, variable delay).
- Load and decode all sounds up front with the **Web Audio API** (`AudioContext` + `AudioBuffer`), not `<audio>` elements, which lag on iOS.
- Trigger the screen change and the sound from the same code path at the same moment. Trim any silence from the start of the audio files.
- The beep and tick can be pre-recorded files or generated with a Web Audio oscillator.

## Each rep

1. Neutral screen.
2. Random wait (3–5 s) so the rhythm can't be predicted.
3. Short **beep** = split-step trigger.
4. Short gap (set by difficulty), then the **cue** (colour + arrow + voice).

## Modes

1. **Return** – single return-of-serve reps.
2. **Volley** – same cues as Return but with a shorter beep-to-cue gap (balls arrive faster at the net).
3. **Return + Rally** – after the return cue, a new cue every 2–3 s (rally tempo), each preceded by a short **tick**. Each cue is randomly forehand/backhand and wide/body. The rally ends at a random point (e.g. after 2–8 shots) with a white **"STOP"** screen.

## Settings

- **Difficulty**: the gap between beep and cue (longer = second serve, shorter = big first serve).
- **Rally tempo**: time between rally cues.
- **Forehand/backhand balance**: e.g. 70% backhand to drill a weak side.
- **Wide/body mix**.
- **Reps per set** and **rest time between sets**.
- **Handedness**: right (default) or left.

Settings should be remembered between visits (e.g. `localStorage`).

## iPhone / iPad requirements (Chrome and Safari)

- A **big Start button**: iOS only allows sound to play after the user taps something. Create/unlock the `AudioContext` inside that tap.
- **Keep the screen awake** during a session (Screen Wake Lock API; re-request it if the page becomes visible again after being hidden).
- Large touch targets for everything; the user may be tapping with sweaty hands or from a distance.
- Show a short note to the user: **the silent/ring switch may mute the app's audio**, so turn ringer mode on and check the volume.

## Testing

- Test on a real iPhone/iPad, in **Chrome first, then Safari**. Desktop browsers don't reproduce iOS audio and wake-lock behaviour exactly.
- If a feature (e.g. keeping the screen awake) works in one browser but not the other, say so and suggest a fallback.
- For local testing on the phone, serve the folder over the local network (e.g. `python3 -m http.server`) and open the Mac's IP address in the browser on the phone.
