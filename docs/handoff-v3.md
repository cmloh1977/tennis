# Handoff: from v2.6 to planning v3

Written 2026-10-28 at the end of the issue #4 thread. Paste this into a new thread to start planning v3.

## Where things stand

- **Live version: 2.6**, https://cmloh1977.github.io/tennis/
- Issue #4 (Camera check with pass / fail) is built: v1.5 → v2.6.
- `CLAUDE.md` describes the whole app, including every camera tuning round, and matches v2.6.
- `CHANGELOG.md` has one entry per version.

## What the app does now (short)

- Modes: Return, Volley, Return + Rally. Cues: forehand or backhand, wide or body (white triangles + the voice saying "wide" / "body").
- **Camera check** (Return and Volley only, phone sideways, front camera, MediaPipe pose tracker stored in the app so it works offline):
  - After each cue it judges the step direction, that a swing happened, the swing type and getting back home within 4 s.
  - **Green** card = pass, with the time from cue to back home. **Red** card = fail, with the reason: NO STEP, WRONG WAY, NO SWING, WRONG SWING or NOT BACK.
  - **Result → next serve** slider (0.5–5 s) sets how quickly the next rep starts.
  - Rest between sets: a small countdown plus a big table per set (✓, ✗, average time, FH average, BH average).
  - After the session: a results list with **Copy results**.
- **Tuning test**: 8 fixed reps (4 done right, 4 deliberate mistakes), used to tune the camera limits.

## Rules the user set (keep these)

- Step **direction** counts, not size. Wide = step toward the ball. Body = small step away to make room; no step on a body ball is a mistake.
- Back home within **4 s**.
- Short / deep cues were removed (v1.12) to keep it simple.
- Right-handed, **one-handed backhand**.
- Keep the rhythm quick after the result card.
- The user can keep about 3 moves in mind at once.
- Cue choices are purely random (not a shuffled deck).

## Not finished yet

- **iPad test of the camera** (needed to close issue #4):
  - Tuning test in Chrome, then in Safari.
  - The home-screen app offline (flight mode).
  - Whether camera permission is asked every time.
  - Heat after several minutes outdoors.

  So far everything has been tested on an Android Pixel, which uses a different browser engine.
- **Swing type** (forehand vs backhand) is the least certain reading. The v2.2 rule worked on all 24 replayed reps and in play, but the margins are modest.

## Open questions and ideas for v3 (not decided)

- Camera check in **Return + Rally** (today Rally never uses the camera).
- Keep **progress between sessions** (today the table and results list reset at each Start).
- Anything that comes out of the iPad test.

## How to work (from CLAUDE.md)

Brainstorm here → write it up as a GitHub Issue on cmloh1977/tennis → new Code-tab session: "read issue #N and propose a plan". Plan first, small steps, test on the phone after each step, publish only on a yes.
