# Changelog

## v2.8 — 2026-10-29

### Figure test: random serves and a flying ball (issue #5, stage 2, step a)
- Each serve now goes at random to your **forehand or backhand**, **wide or body**, using your Handedness, Forehand / backhand and Wide / body settings.
- After the hit the **ball flies toward you**: it bounces in front of you, gets bigger as it comes closer, and leaves the screen far out to the side (wide) or near the middle (body).
- About 1 s later the **answer** shows as the usual triangles and white frame for 1.5 s, then the next serve starts. Call out each serve before the answer.
- **Serve number** at the top left, so you can count how many you read right.
- In the ready pose the racket is now held low and out to the side, so it no longer merges with the chest and ball.
- The figure is a little smaller (about 14%) to leave room for the bounce.

## v2.7 — 2026-10-29

### Figure test (issue #5, stage 1)
- New **Figure test** button on Home. It opens a black screen where a big white stick figure (your opponent, facing you across the net) serves on a loop: ready → toss → racket back → hit → finish, then a short pause.
- Same serve every time, no clues yet. It's only for checking from about 3 m in sunlight whether the figure is big, thick and clear enough, and whether the speed looks real.
- The figure is right-handed, so its racket arm is on your left. The ball is tossed and disappears at the hit (the ball flying toward you comes in stage 2).
- Size, line thickness, head and ball size, speed and the pause between serves are in `FIGURE` in `app.js`.

## v2.6 — 2026-10-28

### Bigger progress table on the rest screen
- The countdown is now small, and the sets so far are a **table with big numbers**: Set, ✓ (right), ✗ (wrong), **Avg**, **FH** and **BH** (average back-home time of the right reps, overall, for forehand cues and for backhand cues; "–" if none).
- The results list, its summary and Copy results also give the forehand and backhand averages.

## v2.5 — 2026-10-28

### Progress during the rest between sets
- With **Camera check** on, the rest screen shows the countdown and, underneath, one line per finished set, e.g. "Set 1   7 right · 3 wrong · avg 2.8 s". Each break adds the newest set below the earlier ones, so you can see whether you're improving.
- "Right" = green cards, "wrong" = red cards; "can't see you" reps aren't counted. The average is the back-home time of the right reps.
- The results list after the session (and Copy results) also shows these lines when there was more than one set.

## v2.4 — 2026-10-28

### Choose how quickly the next serve comes
- New **Result → next serve** slider in Settings, just below Camera check (shown only when it's on): **0.5 s to 5 s**, default 1.2 s.
- Half of the time shows the green / red card (at most 2 s); the rest is the wait before the next beep, a little random (±25%) so the beep can't be timed.
- The first rep of each set still has the normal 3–5 s wait. Saved on the phone; "Reset to defaults" sets it back to 1.2 s.

## v2.3 — 2026-10-28

### Even quicker rhythm
- From the green / red card to the next beep now takes about half as long: the card flashes for **0.5 s** (was 1 s) and the random wait before the next beep is **0.5–1 s** (was 1–2 s). The first rep of each set still has the normal 3–5 s wait.

## v2.2 — 2026-10-28

### Fewer false "wrong swing" on wide forehands
- On a wide forehand the backswing loops up high and the forehand goes out flat to reach the ball, so the "low to high" rule picked the backswing and called it a backhand (7 of 10 wide forehands in one session).
- New check: the swing counts as right if there's a sweep **in the direction the cue asked for** that is at least **80% as big as your biggest sweep**. In every test so far, correct strokes were 86–100% and deliberate wrong swings 53–65%.
- The "unclear" swing label is gone; the results list always shows the stroke that was judged.

### Warning when the camera picture is upright
- If Camera check (or the Tuning test) starts with an upright camera picture, Start stops once with a message: turn the phone sideways and check Auto-rotate is on. Tapping again within a minute starts anyway.

## v2.1 — 2026-10-28

### Quicker rhythm with the Camera check
- The green / red card now just **flashes for 1 s** (was 4 s), then the next serve comes after a short random wait of **1–2 s** (was 3–5 s), because you're already back home and ready. The long pause broke the rhythm.
- The first rep of each set still has the normal 3–5 s wait, so you have time to get into position. All details are still in the results list after the session.

## v2.0 — 2026-10-28

### Pass / fail with the camera ([Issue #4](https://github.com/cmloh1977/tennis/issues/4) done)
- With **Camera check** on, every Return or Volley rep now ends with a **green screen and your time** (from the cue until you're back home) or a **red screen with the reason**: WRONG WAY, NO STEP, WRONG SWING, NO SWING or NOT BACK. If the camera couldn't see you it says CAN'T SEE YOU on black, which doesn't count either way.
- A pass needs: a step the right way (wide = toward the ball, any size; body = a small step away to make room), a swing, the right swing (forehand / backhand), and being **back home within 4 s** of the cue.
- If the camera isn't sure whether it saw a forehand or a backhand, the swing type isn't judged, so a doubtful reading can't turn the screen red. The results list marks it "unclear".
- The **results list** starts with a summary, e.g. "7 of 10 passed · average 2.6 s · best 2.1 s", and shows PASS / FAIL for every rep (also in Copy results).
- The **Tuning test** shows green / red too: reps 1–4 should be green, 5–8 red.
- Tuned over five Tuning test rounds (v1.11–v1.15); the last round read all 8 reps correctly.

## v1.15 — 2026-10-28

### Camera check: the swing goes low to high
- From the fourth Tuning test (6 of 8): two forehands read as backhands. A stroke has three arm movements across the body (backswing, swing, recovery), and the backswing can be almost as big as the swing, so choosing by size or order wasn't reliable.
- Now the swing is the sweep in which the **hitting wrist rises the most** (at least 0.2 shoulder widths): a real forehand or backhand goes low to high. If no sweep rises, the previous rule is used.
- Copy results shows each sweep's rise, so the rule can be checked against real strokes.

## v1.14 — 2026-10-28

### Camera check: better choice of which sweep is the swing
- From the third Tuning test: both backhands were read as forehands. A backhand's backswing (taking the racket back to the left) also crosses the body, and v1.13 took the *first* sweep.
- Now the swing is the **biggest** sweep across the body, unless an **earlier** sweep is at least 80% as big (then the earlier one). Backswings were 43–67% of the real backhand; the forehand in the "stay out" rep was 90% of the arm coming back afterwards. Checked against the third test's results: all 8 reps come out right.

## v1.13 — 2026-10-28

### Camera check: the swing is the first sweep across the body
- From the second Tuning test (7 of 8 reps read correctly): on the "stay out" rep a forehand was read as a backhand. The rule took the *biggest* wrist sweep, which was the arm coming back after the forehand.
- Now the swing is the **first** sweep that really crosses the body: the hitting wrist starts at least 0.3 shoulder widths on one side of the chest, ends on the other side, and travels at least 0.8 within 0.6 s. Taking the racket back doesn't cross the body, so it doesn't count.
- Copy results lists every sweep the camera saw, with its size and when it ended.

## v1.12 — 2026-10-28

### Short / deep removed, to keep things simple
- The **Short / deep cues** switch and the Short and Deep sliders are gone. Cues are never tilted: there are 4 cues again (forehand / backhand × wide / body). Old saved short/deep settings are ignored.
- The Camera check no longer measures stepping forward or back.

### Camera check: the direction of the step is what counts
- Wide = step toward the ball (any size), body = a small step away to make room. The big result now says **STEP RIGHT**, **STEP LEFT** or **NO SIDE STEP**, then the swing and the back-home time. The size (big / small and the number) is still in the results list.
- "No side step" is under 0.5 shoulder widths (was 0.25), from the first Tuning test (real steps read 1.45 or more, standing still 0.0).
- **Swing:** now the biggest fast sweep of the hitting wrist across the body, at least 0.8 shoulder widths within 0.6 s. The old rule needed the wrist to reach well past the chest on both sides, which missed forehands on wide balls.
- **Watch time:** up to 8 s after the cue (was 6), as back-home times reached 5.6 s.
- Copy results also gives each swing's sweep size and time.

### Tuning test: 8 reps
- Reps 1–4 are the 4 correct moves. Reps 5–8 are mistakes on purpose: step the wrong way on a wide forehand, wrong swing, no step on a body forehand (no room made), and staying out.

## v1.11 — 2026-10-25

### Tuning test and Copy results (for tuning the Camera check)
- New **Tuning test** button on the Home screen: 12 fixed reps, always with the camera. Before each rep the screen says in big words what to do (e.g. "DO: BIG STEP RIGHT, FOREHAND") for 5 s, then the beep and cue follow as usual.
- Reps 1–8 are correct moves (big / small step, left / right, forward / back, forehand / backhand). Reps 9–12 are mistakes on purpose (only a small step, wrong swing, no step and no swing, staying out), which the camera should catch.
- The Camera results list shows what each rep **asked** for, and has a **Copy results** button: it copies the whole list, plus the numbers behind each reading, to paste into a chat.
- iPhone tips: place the phone **sideways** for the Camera check (more room for wide moves).

## v1.10 — 2026-10-24

### Camera check: readable from where you stand
- During play the result is now a few **big words**, shown for **5 s** (was 6 small lines for 3 s), for example:
  "BIG STEP RIGHT" · "STEP FORWARD" · "FOREHAND" · "BACK IN 2.1 s". Sideways: BIG STEP / SMALL STEP RIGHT or LEFT, or NO SIDE STEP. Forward/back (only when Short / deep cues is On): STEP FORWARD, STEP BACK or SAME DEPTH. Also BACKHAND, NO SWING, NOT BACK, CAN'T SEE YOU.
- After the session (or when you tap End) a **Camera results** list shows every rep with all the details, to read up close. It stays until the next session with Camera check; reopen it with **Last camera results** on the Home screen.

## v1.9 — 2026-10-24

### Short / neutral / deep
- With **Short / deep cues** On there are now three depths: **short** (sign tilted up, move forward), **neutral** (flat sign, stay at the same depth) and **deep** (tilted down, move back). Before, every cue was either short or deep.
- The one Short / deep slider is replaced by two: **Short** and **Deep** (default 33% each). Neutral is whatever is left, shown under the Deep slider. If the two add up to more than 100%, the other one is lowered.
- Settings saved by an older version start on the new 33 / 33 mix.
- Camera check names a neutral cue, e.g. "Cue: forehand wide neutral".

## v1.8 — 2026-10-23

### Camera check: swing and back-home time (step 2b of [Issue #4](https://github.com/cmloh1977/tennis/issues/4))
- The result screen now also shows the **swing** the camera saw, e.g. "Swing: forehand (at 0.9 s)", and the **back-home time**, e.g. "Back home: 2.1 s".
- A swing = the hitting wrist sweeping quickly (within 0.6 s) across the body, from half a shoulder width on one side of the chest to half on the other. From the hitting side = forehand, the other way = backhand (one- or two-handed).
- Back home = hips back within a third of a shoulder width of the start spot (and less than 8% closer/further), after the swing, staying there for 0.2 s. The time runs from the moment the cue appeared.
- The result now appears **as soon as you are back home**, instead of after a fixed 2.5 s (which came before the end of the swing). If you are not back within 6 s, it shows "not within 6 s". No swing seen = no time.
- Result text is a little smaller on narrow phones so lines don't wrap.

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
