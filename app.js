'use strict';

// ---------- Settings ----------
// The values you can change on the Settings screen. They are saved on the
// phone, so they are remembered next time.
const DEFAULT_SETTINGS = {
  handedness: 'right',     // 'right' or 'left': flips which way the arrows point
  gapSeconds: 0.7,         // difficulty: time between the beep and the cue
  rallyTempoSeconds: 2.5,  // average time from one rally cue to the next
  backhandPercent: 50,     // forehand/backhand balance
  widePercent: 50,         // wide/body mix
  voice: true,             // say "wide" / "body" (off = triangles only)
  repsPerSet: 10,
  sets: 3,
  restSeconds: 60,
  syncOffsetMs: 0,         // + shows the screen later, - plays the voice later
  cameraCheck: false,      // watch with the camera and show what it saw (Return/Volley)
  nextServeSeconds: 1.2,   // Camera check: from the green / red card to the next beep
};

// Fixed timings (not on the Settings screen).
const TIMING = {
  minWaitSeconds: 3,       // random wait before the beep
  maxWaitSeconds: 5,
  cueSeconds: 1.5,         // how long the cue stays on screen
  volleyGapFactor: 0.6,    // Volley uses 60% of the gap (balls arrive faster at the net)
  rallyTempoSpread: 0.5,   // each rally gap is the tempo ± this much, at random
  rallyMinShots: 2,        // the rally stops after a random number of shots,
  rallyMaxShots: 8,        // counting the return
  tickLeadSeconds: 0.5,    // the tick comes this long before each rally cue
  stopSeconds: 2,          // how long the STOP screen shows
  restWarningSeconds: 3,   // beep this long before the next set starts
};

// How each slider on the Settings screen looks and what it changes.
const SLIDERS = [
  { key: 'gapSeconds', label: 'Difficulty', min: 0.3, max: 1.2, step: 0.05,
    show: v => `${v.toFixed(2)} s from beep to cue`,
    hint: 'Shorter = big first serve. Longer = second serve. Volley uses 60% of this.' },
  { key: 'rallyTempoSeconds', label: 'Rally tempo', min: 1.5, max: 4, step: 0.25,
    show: v => `about ${v.toFixed(2)} s between rally shots` },
  { key: 'backhandPercent', label: 'Forehand / backhand', min: 0, max: 100, step: 10,
    show: v => `${100 - v}% forehand · ${v}% backhand` },
  { key: 'widePercent', label: 'Wide / body', min: 0, max: 100, step: 10,
    show: v => `${v}% wide · ${100 - v}% body` },
  { key: 'repsPerSet', label: 'Reps per set', min: 1, max: 30, step: 1,
    show: v => `${v} reps` },
  { key: 'sets', label: 'Sets', min: 1, max: 10, step: 1,
    show: v => (v === 1 ? '1 set' : `${v} sets`) },
  { key: 'restSeconds', label: 'Rest between sets', min: 10, max: 180, step: 10,
    show: v => formatClock(v) },
  { key: 'nextServeSeconds', label: 'Result → next serve', min: 0.5, max: 5, step: 0.1,
    show: v => `about ${v.toFixed(1)} s from the card to the next beep`,
    hint: 'Half of it shows the green / red card (at most 2 s), the rest is a short random wait.' },
  { key: 'syncOffsetMs', label: 'Sound / screen sync', min: -150, max: 150, step: 10,
    show: v => (v === 0 ? 'no adjustment'
      : v > 0 ? `screen ${v} ms later` : `voice ${-v} ms later`),
    hint: 'Only change this if the voice and the triangles don’t arrive together.' },
];

const STORAGE_KEY = 'tennis-trainer-v1';
const settings = { ...DEFAULT_SETTINGS };
let mode = 'return';   // 'return', 'volley' or 'rally'

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof saved.settings?.[key] === typeof DEFAULT_SETTINGS[key]) {
        settings[key] = saved.settings[key];
      }
    }
    if (['return', 'volley', 'rally'].includes(saved.mode)) mode = saved.mode;
  } catch (err) {
    console.warn('Could not read saved settings:', err);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, mode }));
  } catch (err) {
    console.warn('Could not save settings:', err);
  }
}

// Add ?fast=1 to the address to shrink all waits (for quick testing).
const FAST = new URLSearchParams(location.search).has('fast');
const speed = FAST ? 0.25 : 1;

// ---------- Screen elements ----------
const homeScreen = document.getElementById('home');
const settingsScreen = document.getElementById('settings-screen');
const sessionScreen = document.getElementById('session');
const startButton = document.getElementById('start');
const endButton = document.getElementById('end');
const statusText = document.getElementById('status');
const messageText = document.getElementById('message');
const progressText = document.getElementById('progress');
const arrow = document.getElementById('arrow');
const loadStatus = document.getElementById('load-status');

// ---------- Sound ----------
// Web Audio plays sounds with very little delay. The voice clips are loaded
// into memory once, at Start, so nothing has to load when a cue fires.
let audio = null;
const voices = {};

async function setUpAudio() {
  if (audio) return;
  // Ask iOS to treat this as a playback app, so sound can play even with the
  // silent switch on (works in newer Safari; ignored where not supported).
  if (navigator.audioSession) navigator.audioSession.type = 'playback';

  audio = new (window.AudioContext || window.webkitAudioContext)();
  await audio.resume();

  for (const word of ['wide', 'body']) {
    const response = await fetch(`audio/${word}.wav`);
    voices[word] = await audio.decodeAudioData(await response.arrayBuffer());
  }
}

// A short tone made on the spot: no file needed, plays instantly.
function playTone(frequency, seconds) {
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const volume = audio.createGain();
  osc.frequency.value = frequency;
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.exponentialRampToValueAtTime(0.8, now + 0.005);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(volume).connect(audio.destination);
  osc.start(now);
  osc.stop(now + seconds + 0.01);
}

function beep() { playTone(1000, 0.12); }
function tick() { playTone(2000, 0.04); }

// ---------- Keep the screen awake ----------
// First choice: the browser's "wake lock" feature. Backup, for browsers
// without it: a tiny silent video playing on a muted loop, which also stops
// the phone from dimming the screen.
let wakeLock = null;
let backupVideo = null;
const awakeMethodText = document.getElementById('awake-method');

async function keepAwake() {
  try {
    if (!('wakeLock' in navigator)) throw new Error('wake lock not supported');
    wakeLock = await navigator.wakeLock.request('screen');
    awakeMethodText.textContent = 'Screen kept awake by: wake lock';
  } catch (err) {
    console.warn('Wake lock not available, using backup video:', err);
    startBackupVideo();
  }
}

function startBackupVideo() {
  if (!backupVideo) {
    backupVideo = document.createElement('video');
    backupVideo.src = 'media/keepawake.mp4';
    backupVideo.muted = true;
    backupVideo.loop = true;
    backupVideo.playsInline = true;
    backupVideo.setAttribute('playsinline', '');
    backupVideo.className = 'keepawake-video';
    document.body.append(backupVideo);
  }
  backupVideo.play()
    .then(() => { awakeMethodText.textContent = 'Screen kept awake by: backup video'; })
    .catch(err => {
      awakeMethodText.textContent = 'Screen could not be kept awake. Set Auto-Lock to Never.';
      console.warn('Backup video could not play:', err);
    });
}

function allowSleep() {
  if (wakeLock) wakeLock.release();
  wakeLock = null;
  if (backupVideo) backupVideo.pause();
}

// The wake lock is dropped when the app is hidden, so ask again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (currentRun || cameraStream)) keepAwake();
});

// ---------- Cues ----------
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function randomWhole(min, max) { return Math.floor(randomBetween(min, max + 1)); }

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pickShot() {
  return {
    side: Math.random() * 100 < settings.backhandPercent ? 'backhand' : 'forehand',
    placement: Math.random() * 100 < settings.widePercent ? 'wide' : 'body',
  };
}

function showScreen(name) {
  sessionScreen.className = 'screen ' + name;
}

// When the last cue actually appeared on screen (for the Camera check).
let cueShownAt = 0;

// Shows the arrow and plays the voice so they arrive together.
// The phone may report a delay before sound reaches the speaker; if so, the
// screen change is held back by that amount. syncOffsetMs fine-tunes it.
// With the voice off the screen is still held back, because the beep reaches
// the ear late by the same amount: this keeps the beep-to-cue gap as set.
function showCue(shot) {
  const pointsRight = (shot.side === 'forehand') === (settings.handedness === 'right');
  const speakerDelayMs = ((audio.outputLatency || audio.baseLatency || 0) * 1000);
  const screenDelayMs = speakerDelayMs + settings.syncOffsetMs;

  if (settings.voice) {
    const voice = audio.createBufferSource();
    voice.buffer = voices[shot.placement];
    voice.connect(audio.destination);
    // If the screen should come first (negative offset), delay the voice instead.
    voice.start(audio.currentTime + Math.max(0, -screenDelayMs) / 1000);
  }

  const paint = () => {
    arrow.classList.toggle('left', !pointsRight);
    arrow.classList.toggle('wide', shot.placement === 'wide');
    showScreen(shot.side);
    cueShownAt = performance.now();
  };
  if (screenDelayMs > 0) setTimeout(paint, screenDelayMs);
  else paint();
}

// ---------- Running a session ----------
// currentRun is replaced each time Start is pressed; End marks it stopped.
let currentRun = null;

function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000 * speed));
}

// Reaction gaps are the drill itself, so they are never shortened by ?fast=1.
function waitExactly(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

// Neutral screen, random wait, beep, gap, cue. Used by all three modes and
// the Tuning test (which passes its own shot). Returns the shot that was
// cued (nothing if the session was ended).
async function serveRep(run, gapSeconds, fixedShot = null) {
  showScreen('neutral');
  // Right after a Camera check card you're already back home and ready, so
  // the wait is the rest of the "Result → next serve" time. Still a little
  // random, so the beep can't be timed.
  const [minWait, maxWait] = run.afterCard
    ? [run.nextWait * (1 - CAMERA.waitSpread), run.nextWait * (1 + CAMERA.waitSpread)]
    : [TIMING.minWaitSeconds, TIMING.maxWaitSeconds];
  run.afterCard = false;
  await wait(randomBetween(minWait, maxWait));
  if (run.stopped) return;

  beep();                              // split-step trigger
  await waitExactly(gapSeconds);
  if (run.stopped) return;

  const shot = fixedShot || pickShot();
  showCue(shot);
  return shot;
}

async function returnRep(run) {
  const shot = await serveRep(run, settings.gapSeconds);
  await wait(TIMING.cueSeconds);
  await showCheck(run, shot);
}

async function volleyRep(run) {
  const shot = await serveRep(run, settings.gapSeconds * TIMING.volleyGapFactor);
  await wait(TIMING.cueSeconds);
  await showCheck(run, shot);
}

// The return, then a new cue every few seconds (each after a tick), until the
// rally stops at a random shot with a white STOP screen.
async function rallyRep(run) {
  const totalShots = randomWhole(TIMING.rallyMinShots, TIMING.rallyMaxShots);
  await serveRep(run, settings.gapSeconds);

  for (let shot = 2; shot <= totalShots; shot++) {
    const interval = randomBetween(settings.rallyTempoSeconds - TIMING.rallyTempoSpread,
                                   settings.rallyTempoSeconds + TIMING.rallyTempoSpread);
    // Go back to neutral between cues, so two cues in a row on the same side
    // still look like two separate cues.
    const cueOnScreen = Math.min(TIMING.cueSeconds, interval - TIMING.tickLeadSeconds - 0.3);
    await waitExactly(cueOnScreen);
    if (run.stopped) return;
    showScreen('neutral');

    await waitExactly(interval - cueOnScreen - TIMING.tickLeadSeconds);
    if (run.stopped) return;
    tick();
    await waitExactly(TIMING.tickLeadSeconds);
    if (run.stopped) return;
    showCue(pickShot());
  }

  await waitExactly(Math.min(TIMING.cueSeconds, settings.rallyTempoSeconds - TIMING.rallyTempoSpread));
  if (run.stopped) return;
  messageText.textContent = 'STOP';
  showScreen('stop');
  await wait(TIMING.stopSeconds);
  messageText.textContent = '';
}

// A big countdown between sets, with a beep just before the next set starts.
// With the Camera check, the sets so far are listed under the countdown
// (right / wrong and average time), one line added per set.
async function rest(run, nextSet) {
  run.afterCard = false;   // the next set starts with the normal wait
  const sets = checkLog.length ? setStats() : [];
  progressText.replaceChildren(sets.length ? progressTable(sets) : '');
  // As big as fits: up to 9 sets (10 rows with the header) on a sideways phone.
  progressText.style.fontSize = `min(5.8vw, ${Math.min(12, 46 / (sets.length + 1))}vh)`;
  showScreen(sets.length ? 'rest progress' : 'rest');
  statusText.textContent = `Rest · next: set ${nextSet}/${settings.sets}`;
  for (let left = settings.restSeconds; left > 0; left--) {
    messageText.textContent = formatClock(left);
    if (left === TIMING.restWarningSeconds) beep();
    await wait(1);
    if (run.stopped) break;
  }
  messageText.textContent = '';
  progressText.textContent = '';
}

const repForMode = { return: returnRep, volley: volleyRep, rally: rallyRep };

// The Tuning test runs its own fixed reps: one set, no rest.
async function runSession(tuning = false) {
  const run = { stopped: false, tuning };
  currentRun = run;
  messageText.textContent = '';
  const doRep = tuning ? tuningRep : repForMode[mode];
  const sets = tuning ? 1 : settings.sets;
  const reps = tuning ? TUNING_REPS.length : settings.repsPerSet;

  for (let set = 1; set <= sets; set++) {
    for (let rep = 1; rep <= reps; rep++) {
      Object.assign(run, { set, rep });
      statusText.textContent = tuning ? `Tuning test · Rep ${rep}/${reps}`
        : `Set ${set}/${sets} · Rep ${rep}/${reps}`;
      await doRep(run);
      if (run.stopped) return;
    }
    if (set < sets) {
      await rest(run, set + 1);
      if (run.stopped) return;
    }
  }

  showScreen('neutral');
  statusText.textContent = '';
  messageText.textContent = 'Done!';
  await wait(2);
  if (!run.stopped) endSession();
}

function endSession() {
  if (currentRun) currentRun.stopped = true;
  currentRun = null;
  allowSleep();
  if (cameraUse === 'session') stopCamera();
  messageText.textContent = '';
  showScreen('neutral');
  sessionScreen.hidden = true;
  homeScreen.hidden = false;
  openResultsButton.hidden = checkLog.length === 0;
  if (checkLog.length) showResults();
}

// iPhones only allow sound after a tap, so sound is switched on here.
// When Start last warned that the camera picture is upright.
let uprightWarnedAt = -Infinity;

// Start and Tuning test both come here. withCamera: start the camera too.
async function start(withCamera, tuning = false) {
  startButton.disabled = true;
  tuningButton.disabled = true;
  // Ask to keep the screen awake straight away, while the tap still counts.
  keepAwake();
  loadStatus.textContent = 'Loading sounds…';
  try {
    await setUpAudio();
    loadStatus.textContent = '';
  } catch (err) {
    loadStatus.textContent = 'Could not load sounds. Check your connection and try again.';
    console.error(err);
    audio = null;
    allowSleep();
    startButton.disabled = false;
    tuningButton.disabled = false;
    return;
  }
  if (withCamera) {
    checkLog.length = 0;
    cameraUse = 'session';
    try {
      await startCamera(text => { loadStatus.textContent = text; });
      loadStatus.textContent = '';
      // Wide moves leave an upright picture. Warn once; a second tap within
      // a minute starts anyway.
      const upright = cameraVideo.videoHeight > cameraVideo.videoWidth;
      if (upright && performance.now() - uprightWarnedAt > 60000) {
        uprightWarnedAt = performance.now();
        stopCamera();
        allowSleep();
        loadStatus.textContent = 'The camera picture is upright, so wide moves may leave it.\n'
          + 'Turn the phone sideways (check that Auto-rotate is on), then tap again.\n'
          + 'Or tap again to start upright anyway.';
        startButton.disabled = false;
        tuningButton.disabled = false;
        return;
      }
    } catch (err) {
      loadStatus.textContent = tuning ? err.message
        : `${err.message}\nOr turn off Camera check in Settings.`;
      allowSleep();
      startButton.disabled = false;
      tuningButton.disabled = false;
      return;
    }
  }
  startButton.disabled = false;
  tuningButton.disabled = false;
  homeScreen.hidden = true;
  sessionScreen.hidden = false;
  runSession(tuning);
}

const tuningButton = document.getElementById('open-tuning');
// Camera check: Return and Volley only (rally cues come too fast).
startButton.addEventListener('click', () => start(settings.cameraCheck && mode !== 'rally'));
tuningButton.addEventListener('click', () => start(true, true));

endButton.addEventListener('click', endSession);

// ---------- Home screen: mode buttons ----------
const modeButtons = document.querySelectorAll('.mode-button');

function showMode() {
  for (const button of modeButtons) {
    button.classList.toggle('selected', button.dataset.mode === mode);
  }
}

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;
    showMode();
    save();
  });
}

// ---------- Settings screen ----------
const handButtons = document.querySelectorAll('.hand-button');
const sliderInputs = {};

function showHandedness() {
  for (const button of handButtons) {
    button.classList.toggle('selected', button.dataset.hand === settings.handedness);
  }
}

for (const button of handButtons) {
  button.addEventListener('click', () => {
    settings.handedness = button.dataset.hand;
    showHandedness();
    save();
  });
}

// Build one labelled slider per entry in SLIDERS.
for (const slider of SLIDERS) {
  const row = document.createElement('label');
  row.className = 'setting';
  row.innerHTML = `
    <span class="setting-label">${slider.label}</span>
    <span class="setting-value"></span>
    <input type="range" min="${slider.min}" max="${slider.max}" step="${slider.step}">
    ${slider.hint ? `<span class="setting-hint">${slider.hint}</span>` : ''}`;
  const input = row.querySelector('input');
  const value = row.querySelector('.setting-value');

  input.addEventListener('input', () => {
    settings[slider.key] = Number(input.value);
    value.textContent = slider.show(settings[slider.key]);
    save();
  });
  sliderInputs[slider.key] = { input, value, slider, row };
  document.getElementById('sliders').append(row);
}

// Voice on/off, placed just above the Wide / body slider.
const voiceButtons = document.querySelectorAll('.voice-button');
sliderInputs.widePercent.row.before(document.getElementById('voice-toggle'));

function showVoice() {
  for (const button of voiceButtons) {
    button.classList.toggle('selected', button.dataset.on === String(settings.voice));
  }
}

for (const button of voiceButtons) {
  button.addEventListener('click', () => {
    settings.voice = button.dataset.on === 'true';
    showVoice();
    save();
  });
}

// Camera check on/off.
const cameraCheckButtons = document.querySelectorAll('.camera-check-button');

// Its "Result → next serve" slider sits just below and only shows when it's on.
const nextServeRow = sliderInputs.nextServeSeconds.row;
document.getElementById('camera-check-toggle').after(nextServeRow);

function showCameraCheck() {
  for (const button of cameraCheckButtons) {
    button.classList.toggle('selected', button.dataset.on === String(settings.cameraCheck));
  }
  nextServeRow.hidden = !settings.cameraCheck;
}

for (const button of cameraCheckButtons) {
  button.addEventListener('click', () => {
    settings.cameraCheck = button.dataset.on === 'true';
    showCameraCheck();
    save();
  });
}

function showSettings() {
  showHandedness();
  showVoice();
  showCameraCheck();
  for (const { input, value, slider } of Object.values(sliderInputs)) {
    input.value = settings[slider.key];
    value.textContent = slider.show(settings[slider.key]);
  }
}

document.getElementById('open-settings').addEventListener('click', () => {
  showSettings();
  homeScreen.hidden = true;
  settingsScreen.hidden = false;
  settingsScreen.scrollTop = 0;
});

document.getElementById('close-settings').addEventListener('click', () => {
  settingsScreen.hidden = true;
  homeScreen.hidden = false;
});

document.getElementById('reset-settings').addEventListener('click', () => {
  Object.assign(settings, DEFAULT_SETTINGS);
  save();
  showSettings();
});

// ---------- Camera test ----------
// Shows the front camera with a stick figure drawn over the player, to check
// that tracking works outdoors and that the player stays in the picture.
// The pose tracker (MediaPipe, in vendor/) is only loaded when this opens.
// The picture stays on the phone; nothing is recorded or sent anywhere.
const cameraScreen = document.getElementById('camera-screen');
const cameraVideo = document.getElementById('camera-video');
const cameraCanvas = document.getElementById('camera-canvas');
const cameraReadout = document.getElementById('camera-readout');

// Body points found by MediaPipe (numbers from its list of 33) and the lines
// joining them: shoulders, arms, body, legs.
const NOSE = 0, LEFT_SHOULDER = 11, RIGHT_SHOULDER = 12, LEFT_HIP = 23, RIGHT_HIP = 24;
const LEFT_WRIST = 15, RIGHT_WRIST = 16;
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
];
const JOINTS = [13, 14, 15, 16, 25, 26, 27, 28];   // elbows, wrists, knees, ankles
const EDGE_MARGIN = 0.1;   // hips this close to an edge (share of the picture) = leaving

let poseTracker = null;
let cameraStream = null;
let cameraUse = null;      // 'test' (Camera test screen) or 'session' (Camera check)
let lastVideoTime = -1;
let framesCounted = 0;
let countStart = 0;

async function loadPose() {
  if (poseTracker) return;
  const { FilesetResolver, PoseLandmarker } = await import('./vendor/mediapipe/vision_bundle.mjs');
  const files = await FilesetResolver.forVisionTasks('vendor/mediapipe/wasm');
  const options = delegate => ({
    baseOptions: { modelAssetPath: 'vendor/mediapipe/pose_landmarker_lite.task', delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  // The graphics chip is fastest; fall back to the main processor.
  try {
    poseTracker = await PoseLandmarker.createFromOptions(files, options('GPU'));
  } catch (err) {
    console.warn('GPU tracking not available, using CPU:', err);
    poseTracker = await PoseLandmarker.createFromOptions(files, options('CPU'));
  }
}

// Turns on the front camera (iPhones ask permission the first time) and
// loads the tracker, then starts trackFrame(). say() shows progress.
// Returns false if stopCamera() was called while it was still loading.
async function startCamera(say) {
  say('Starting camera…');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch (err) {
    console.error(err);
    throw new Error(err.name === 'NotAllowedError'
      ? 'Camera not allowed.\nAllow camera access for this site, then try again.'
      : 'Could not start the camera.');
  }
  cameraStream = stream;
  cameraVideo.srcObject = stream;
  await cameraVideo.play();

  say('Loading body tracker…');
  try {
    await loadPose();
  } catch (err) {
    console.error(err);
    stopCamera();
    throw new Error('Could not load the body tracker.');
  }
  if (cameraStream !== stream) return false;
  lastVideoTime = -1;
  framesCounted = 0;
  countStart = performance.now();
  samples.length = 0;
  requestAnimationFrame(trackFrame);
  return true;
}

function stopCamera() {
  if (cameraStream) for (const track of cameraStream.getTracks()) track.stop();
  cameraStream = null;
  cameraUse = null;
  cameraVideo.srcObject = null;
  samples.length = 0;
}

async function openCamera() {
  homeScreen.hidden = true;
  cameraScreen.hidden = false;
  keepAwake();
  cameraUse = 'test';
  try {
    await startCamera(text => { cameraReadout.textContent = text; });
  } catch (err) {
    cameraReadout.textContent = err.message;
  }
}

function closeCamera() {
  stopCamera();
  allowSleep();
  cameraScreen.hidden = true;
  homeScreen.hidden = false;
}

// Runs once per screen refresh: find the body in the newest camera picture.
// The Camera test draws it; a session only remembers where the body was.
function trackFrame() {
  if (!cameraStream) return;
  requestAnimationFrame(trackFrame);
  if (cameraVideo.readyState < 2 || cameraVideo.currentTime === lastVideoTime) return;
  lastVideoTime = cameraVideo.currentTime;

  const now = performance.now();
  const result = poseTracker.detectForVideo(cameraVideo, now);
  const body = result.landmarks[0];
  if (cameraUse === 'session') {
    recordSample(body, now);
    return;
  }
  drawCamera(body);

  // Update the readout twice a second.
  framesCounted++;
  const elapsed = performance.now() - countStart;
  if (elapsed >= 500) {
    const fps = Math.round(framesCounted * 1000 / elapsed);
    const shape = cameraVideo.videoWidth > cameraVideo.videoHeight ? 'sideways' : 'upright';
    let lines = [`${fps} fps · picture ${shape}`];
    if (!body) {
      lines.push('No one found');
    } else {
      const hips = middle(body[LEFT_HIP], body[RIGHT_HIP]);
      const nearEdge = hips.x < EDGE_MARGIN || hips.x > 1 - EDGE_MARGIN
                    || hips.y < EDGE_MARGIN || hips.y > 1 - EDGE_MARGIN;
      lines.push(nearEdge ? 'Hips: near the edge!' : 'Hips: in the picture');
    }
    cameraReadout.textContent = lines.join('\n');
    framesCounted = 0;
    countStart = performance.now();
  }
}

function middle(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

// Draws the camera picture, mirrored like a selfie, with thick yellow lines
// (easy to see in sunlight), white dots on the joints, a big cyan dot on the
// hitting wrist and a big white dot on the hips.
function drawCamera(body) {
  const w = cameraVideo.videoWidth;
  const h = cameraVideo.videoHeight;
  if (cameraCanvas.width !== w || cameraCanvas.height !== h) {
    cameraCanvas.width = w;
    cameraCanvas.height = h;
  }
  const ctx = cameraCanvas.getContext('2d');
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(cameraVideo, 0, 0, w, h);
  if (body) {
    const size = Math.max(w, h);
    const at = point => [point.x * w, point.y * h];
    ctx.strokeStyle = '#ffeb00';
    ctx.lineWidth = size / 80;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [from, to] of BONES) {
      ctx.moveTo(...at(body[from]));
      ctx.lineTo(...at(body[to]));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(...at(body[NOSE]), size / 40, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (const joint of JOINTS) {
      ctx.beginPath();
      ctx.arc(...at(body[joint]), size / 90, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(...at(middle(body[LEFT_HIP], body[RIGHT_HIP])), size / 50, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(...at(body[settings.handedness === 'right' ? RIGHT_WRIST : LEFT_WRIST]), size / 45, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Camera check (during a session) ----------
// With the Camera check setting on, the camera watches during Return and
// Volley sessions. After each cue the app shows what it saw: how far you
// moved sideways, whether you came closer or went further away, which swing
// it saw, and how long it took from the cue until you were back home.
// Distances are measured in shoulder widths, so they don't depend on how far
// away the phone is.
const CAMERA = {
  startSeconds: 0.5,       // where the hips are this long before the cue = start spot
  maxWatchSeconds: 4,      // back home within this time = pass (the user's choice; it was
                           // 8 s for tuning). The result shows by then at the latest.
  // Card and wait come from the "Result → next serve" setting: half of it is
  // the card (at most maxCardSeconds), the rest the wait before the next beep,
  // ± waitSpread of it at random.
  maxCardSeconds: 2,
  waitSpread: 0.25,
  minVisibility: 0.5,      // how sure the tracker must be that it sees a body point
  minSamples: 3,           // fewer pictures than this = "Couldn't see you"
  // Limits in shoulder widths. First Tuning test (v1.11): small steps read
  // 1.45-2.0, big steps 2.0-3.9, no step 0.0. Only the direction of the step
  // counts (wide = toward the ball, body = away to make room); big/small is
  // just shown in the results list.
  minMove: 0.5,            // sideways move smaller than this = no side step
  bigMove: 2.2,            // sideways move at least this = big, otherwise small
  swingStart: 0.3,         // a swing: the hitting wrist starts at least this far on one
                           // side of the chest centre, ends on the other side,
  swingTravel: 0.8,        // travels at least this far (missed wide forehands swept
                           // 1.5-2.1, no swing 0.35)
  swingSeconds: 0.6,       // within this time
  swingShare: 0.8,         // right swing = a sweep the cue's way at least this share of
                           // the biggest sweep (correct strokes 86-100%, wrong 53-65%)
  homeDistance: 0.33,      // back home: hips this close to the start spot sideways
  homeHoldSeconds: 0.2,    // and staying there this long
  keepSeconds: 10,         // forget body positions older than this
};

// Body positions seen during a session, newest last.
const samples = [];
// Every rep's full result, shown in the results list after the session.
// Kept until the next session with Camera check starts.
const checkLog = [];
let checkLogPicture = '';   // 'sideways' or 'upright' camera picture

function recordSample(body, time) {
  const seen = body && [LEFT_SHOULDER, RIGHT_SHOULDER, LEFT_HIP, RIGHT_HIP]
    .every(i => (body[i].visibility ?? 1) >= CAMERA.minVisibility);
  if (seen) {
    // In pixels, so sideways and up-down distances compare fairly.
    const w = cameraVideo.videoWidth;
    const h = cameraVideo.videoHeight;
    const at = i => ({ x: body[i].x * w, y: body[i].y * h });
    const leftShoulder = at(LEFT_SHOULDER), rightShoulder = at(RIGHT_SHOULDER);
    const shoulders = middle(leftShoulder, rightShoulder);
    const hips = middle(at(LEFT_HIP), at(RIGHT_HIP));
    samples.push({
      time,
      hips,
      shoulders,
      wrist: at(settings.handedness === 'right' ? RIGHT_WRIST : LEFT_WRIST),
      shoulderWidth: Math.hypot(rightShoulder.x - leftShoulder.x, rightShoulder.y - leftShoulder.y),
      // Which way is the player's right in the picture (+1 or -1). Taken from
      // the body itself, so it works whether or not the camera mirrors.
      rightward: Math.sign(rightShoulder.x - leftShoulder.x),
    });
  }
  while (samples.length && samples[0].time < time - CAMERA.keepSeconds * 1000) samples.shift();
}

function average(list, value) {
  return list.reduce((sum, item) => sum + value(item), 0) / list.length;
}

// Evens out jitter: each value becomes the average of itself and its neighbours.
function smooth(values, reach = 2) {
  return values.map((_, i) => {
    const near = values.slice(Math.max(0, i - reach), i + reach + 1);
    return near.reduce((sum, v) => sum + v, 0) / near.length;
  });
}

// The value furthest from zero (keeps its sign).
function furthest(values) {
  return values.reduce((best, v) => (Math.abs(v) > Math.abs(best) ? v : best), 0);
}

// Compares what the body did after the cue (up to now) with the start spot.
// Returns null if the camera didn't see enough of the player.
function analyseRep(cueTime, now) {
  const before = samples.filter(s => s.time >= cueTime - CAMERA.startSeconds * 1000 && s.time <= cueTime);
  const after = samples.filter(s => s.time > cueTime && s.time <= now);
  if (before.length < CAMERA.minSamples || after.length < CAMERA.minSamples) return null;

  const start = {
    x: average(before, s => s.hips.x),
    shoulderWidth: average(before, s => s.shoulderWidth),
    rightward: Math.sign(average(before, s => s.rightward)) || 1,
  };
  // + = toward the player's right, in shoulder widths
  const sideways = smooth(after.map(s => (s.hips.x - start.x) * start.rightward / start.shoulderWidth));
  // Hitting wrist across the body: + = on the player's right of the chest centre
  const across = smooth(after.map(s => (s.wrist.x - s.shoulders.x) * start.rightward / start.shoulderWidth), 1);
  // Hitting wrist height: + = above the shoulders, in shoulder widths
  const height = smooth(after.map(s => (s.shoulders.y - s.wrist.y) / start.shoulderWidth), 1);
  const times = after.map(s => s.time);

  const sweeps = findSweeps(across, times)
    .map(w => ({ ...w, rise: height[w.end] - height[w.start] }));
  // "Back home" only counts after the stroke: after the last big sweep.
  const big = sweeps.filter(w => Math.abs(w.travel) >= CAMERA.swingShare * biggestSweep(sweeps));
  const swing = big.length ? { at: big[big.length - 1].at } : null;
  return {
    sideways: furthest(sideways),
    swing,
    sweeps,
    homeAt: swing ? findHome(sideways, times, swing.at) : null,
    // For tuning: the wrist's reach on each side of the chest, and how close
    // the hips came back after the swing.
    reach: { right: Math.max(0, ...across), left: Math.max(0, ...across.map(v => -v)) },
    closestHome: swing ? Math.min(...sideways.filter((_, i) => times[i] >= swing.at).map(Math.abs)) : null,
  };
}

// Every quick sweep of the hitting wrist across the body, in time order: it
// starts at least swingStart on one side of the chest centre and ends on the
// other side, at least swingTravel away, within swingSeconds. Besides the
// swing this finds e.g. a backhand's backswing (before) and the arm coming
// back (after); strokeSeen() judges them.
function findSweeps(across, times) {
  const sweeps = [];
  let i = 0;
  // The biggest sweep that starts at k and ends on the other side, or null.
  const sweepFrom = k => {
    let best = null;
    for (let j = k + 1; j < across.length && times[j] - times[k] <= CAMERA.swingSeconds * 1000; j++) {
      const travel = across[j] - across[k];
      if (Math.sign(across[j]) === -Math.sign(across[k]) && Math.abs(travel) >= CAMERA.swingTravel
          && (!best || Math.abs(travel) > Math.abs(best.travel))) {
        best = { travel, at: times[j], seconds: (times[j] - times[k]) / 1000, start: k, end: j };
      }
    }
    return best;
  };
  while (i < across.length) {
    const from = Math.sign(across[i]);
    let best = Math.abs(across[i]) >= CAMERA.swingStart ? sweepFrom(i) : null;
    // Found one: it may really start a little later (further out on the
    // same side), so measure it from where it is biggest.
    for (let k = i + 1; best && k < best.end && Math.sign(across[k]) === from; k++) {
      const later = sweepFrom(k);
      if (later && Math.abs(later.travel) > Math.abs(best.travel)) best = later;
    }
    if (best) {
      sweeps.push(best);
      i = best.end;            // look for the next sweep after this one
    } else {
      i++;
    }
  }
  return sweeps;
}

function biggestSweep(sweeps) {
  return Math.max(0, ...sweeps.map(w => Math.abs(w.travel)));
}

// Which stroke the arm movements show, given the cue. A stroke has a
// backswing, the swing and a recovery, alternating direction, and the
// backswing can be as big as the swing (one-handed backhand take-back; the
// looped backswing of a wide forehand, which also rises more than the flat,
// reaching swing). Picking one sweep by size, order or rise kept getting it
// wrong (v1.12-v2.1). So: the cue's stroke counts as seen if there is a sweep
// its way at least swingShare of the biggest sweep; otherwise the other one.
// Forehand = from the hitting side across the body; backhand = the other way.
function strokeSeen(shot, result) {
  const hittingSide = settings.handedness === 'right' ? 1 : -1;
  const wayOf = stroke => (stroke === 'forehand' ? -hittingSide : hittingSide);   // sign of travel
  const enough = CAMERA.swingShare * biggestSweep(result.sweeps);
  const its = result.sweeps.filter(w => Math.sign(w.travel) === wayOf(shot.side) && Math.abs(w.travel) >= enough);
  const other = shot.side === 'forehand' ? 'backhand' : 'forehand';
  const seen = its.length ? shot.side : other;
  const sweep = result.sweeps.filter(w => Math.sign(w.travel) === wayOf(seen))
    .reduce((top, w) => (!top || Math.abs(w.travel) > Math.abs(top.travel) ? w : top), null);
  return { side: seen, at: sweep.at };
}

// The first moment after the swing when the hips are back near the start spot
// and stay there for a moment. null = not yet.
function findHome(sideways, times, after) {
  const near = i => Math.abs(sideways[i]) <= CAMERA.homeDistance;
  for (let i = 0; i < times.length; i++) {
    if (times[i] < after || !near(i)) continue;
    let j = i;
    while (j < times.length && near(j) && times[j] - times[i] < CAMERA.homeHoldSeconds * 1000) j++;
    if (j === times.length) return null;            // still waiting to see if you stay
    if (near(j)) return times[i];
  }
  return null;
}

// The readings in words, shared by the big result and the results list.
function readings(result) {
  const size = Math.abs(result.sideways);
  return {
    size,
    side: result.sideways > 0 ? 'right' : 'left',
    stayed: size < CAMERA.minMove,
    big: size >= CAMERA.bigMove,
  };
}

function cueName(shot) {
  return `${shot.side} ${shot.placement}`;
}

// Pass or fail for one rep. The step's direction counts, not its size:
// wide = toward the ball (the side the cue points to), body = a small step
// away to make room. Returns { pass, reason }; pass is null when the camera
// couldn't see you (not counted either way).
function judge(shot, result) {
  if (!result) return { pass: null, reason: 'CAN’T SEE YOU' };
  const r = readings(result);
  const ballSide = (shot.side === 'forehand') === (settings.handedness === 'right') ? 'right' : 'left';
  const stepTo = shot.placement === 'wide' ? ballSide : (ballSide === 'right' ? 'left' : 'right');
  if (r.stayed) return { pass: false, reason: 'NO STEP' };
  if (r.side !== stepTo) return { pass: false, reason: 'WRONG WAY' };
  if (!result.swing) return { pass: false, reason: 'NO SWING' };
  if (strokeSeen(shot, result).side !== shot.side) return { pass: false, reason: 'WRONG SWING' };
  if (!result.homeAt) return { pass: false, reason: 'NOT BACK' };
  return { pass: true, time: (result.homeAt - cueShownAt) / 1000 };
}

function verdictText(verdict) {
  if (verdict.pass) return `PASS ${verdict.time.toFixed(1)} s`;
  return verdict.pass === null ? 'Not judged: can’t see you' : `FAIL: ${verdict.reason.toLowerCase()}`;
}

// All the details, for the results list after the session.
function describeResult(shot, result) {
  const lines = [`Cue: ${cueName(shot)}`];
  if (!result) {
    lines.push('Couldn’t see you');
    return lines.join('\n');
  }
  const r = readings(result);
  lines.push(`Moved: ${r.stayed ? 'stayed' : `${r.side}, ${r.big ? 'big' : 'small'}`} (${r.size.toFixed(1)})`);
  if (!result.swing) {
    lines.push('Swing: none seen');
    lines.push('Back home: no time (no swing)');
  } else {
    const stroke = strokeSeen(shot, result);
    lines.push(`Swing: ${stroke.side} (at ${seconds(stroke.at)} s)`);
    lines.push(result.homeAt ? `Back home: ${seconds(result.homeAt)} s`
      : `Back home: not within ${CAMERA.maxWatchSeconds} s`);
  }
  return lines.join('\n');
}

// Time since the cue, e.g. "2.1".
function seconds(time) { return ((time - cueShownAt) / 1000).toFixed(1); }

// After a Return or Volley cue: keep watching until you are back home after
// your swing (at most maxWatchSeconds after the cue), then show green (pass,
// with the time) or red (fail, with the reason). asked = what the Tuning test
// told you to do.
async function showCheck(run, shot, asked = null) {
  if (!shot || cameraUse !== 'session' || run.stopped) return;
  showScreen('neutral');
  const end = cueShownAt + CAMERA.maxWatchSeconds * 1000;
  while (performance.now() < end && !analyseRep(cueShownAt, performance.now())?.homeAt) {
    await waitExactly(0.1);
    if (run.stopped) return;
  }
  const result = analyseRep(cueShownAt, Math.min(performance.now(), end));
  const verdict = judge(shot, result);
  checkLogPicture = cameraVideo.videoWidth > cameraVideo.videoHeight ? 'sideways' : 'upright';
  checkLog.push({
    label: run.tuning ? `Rep ${run.rep}` : `Set ${run.set} · Rep ${run.rep}`,
    set: run.set,
    side: shot.side,
    verdict,
    details: verdictText(verdict) + '\n' + (asked ? `Asked: ${asked.join(', ').toLowerCase()}\n` : '')
      + describeResult(shot, result),
    numbers: rawNumbers(result),
  });
  // Green with the back-home time, red with the reason, black if not seen.
  // A full colour and no white frame, so it can't be mistaken for a cue.
  if (verdict.pass) {
    messageText.innerHTML = `<span class="verdict-time">${verdict.time.toFixed(1)} s</span>`;
    showScreen('pass');
  } else {
    messageText.textContent = verdict.reason;
    showScreen(verdict.pass === null ? 'result' : 'fail');
  }
  const cardSeconds = Math.min(CAMERA.maxCardSeconds, settings.nextServeSeconds / 2);
  await wait(cardSeconds);
  messageText.textContent = '';
  run.afterCard = true;
  run.nextWait = settings.nextServeSeconds - cardSeconds;
}

// The numbers behind the readings, for tuning the limits in CAMERA.
// Only in the copied text, not on screen.
function rawNumbers(result) {
  if (!result) return 'Numbers: none (not seen)';
  const n = v => (v >= 0 ? '+' : '') + v.toFixed(2);
  // Every sweep: size, rise, and when it ended after the cue.
  const swing = result.sweeps.length
    ? 'sweeps ' + result.sweeps.map(w => `${n(w.travel)} rise ${n(w.rise)} in ${w.seconds.toFixed(2)} s at ${seconds(w.at)} s`).join(', ')
    : 'sweeps -';
  return `Numbers: side ${n(result.sideways)}, ${swing}, `
    + `wrist reach R ${result.reach.right.toFixed(2)} / L ${result.reach.left.toFixed(2)}, `
    + `closest home ${result.closestHome === null ? '-' : result.closestHome.toFixed(2)}`;
}

// ---------- Tuning test ----------
// A fixed list of 8 reps for tuning the Camera check. Before each rep the
// screen says what to do (always the same, so nothing has to be remembered).
// Reps 1-4 are correct moves; 5-8 are mistakes made on purpose, which the
// camera should catch. What counts is the direction of the step: wide =
// toward the ball (any size), body = a small step away to make room.
// Written for right-handed; left-handed swaps the words LEFT and RIGHT (the
// cues already swap by themselves).
const TUNING_REPS = [
  { side: 'forehand', placement: 'wide', asked: ['STEP RIGHT', 'FOREHAND'] },
  { side: 'backhand', placement: 'wide', asked: ['STEP LEFT', 'BACKHAND'] },
  { side: 'forehand', placement: 'body', asked: ['SMALL STEP LEFT', 'FOREHAND'] },
  { side: 'backhand', placement: 'body', asked: ['SMALL STEP RIGHT', 'BACKHAND'] },
  { side: 'forehand', placement: 'wide', asked: ['STEP LEFT', 'FOREHAND'] },           // wrong direction
  { side: 'backhand', placement: 'wide', asked: ['STEP LEFT', 'BUT FOREHAND'] },       // wrong swing
  { side: 'forehand', placement: 'body', asked: ['NO STEP', 'FOREHAND'] },             // no room made
  { side: 'forehand', placement: 'wide', asked: ['STEP RIGHT', 'FOREHAND', 'STAY OUT'] }, // not back
];
const TUNING_DO_SECONDS = 5;   // how long "DO: ..." shows before each rep

function tuningWords(lines) {
  if (settings.handedness === 'right') return lines;
  return lines.map(line => line.replace(/RIGHT|LEFT/, side => (side === 'RIGHT' ? 'LEFT' : 'RIGHT')));
}

async function tuningRep(run) {
  const item = TUNING_REPS[run.rep - 1];
  const asked = tuningWords(item.asked);
  messageText.textContent = ['DO:', ...asked].join('\n');
  showScreen('instruction');
  await wait(TUNING_DO_SECONDS);
  messageText.textContent = '';
  if (run.stopped) return;
  const shot = await serveRep(run, settings.gapSeconds, item);
  await wait(TIMING.cueSeconds);
  await showCheck(run, shot, asked);
}

// ---------- Results list (after a session with Camera check) ----------
const resultsScreen = document.getElementById('results-screen');
const resultsList = document.getElementById('results-list');
const resultsSummaryText = document.getElementById('results-summary');
const openResultsButton = document.getElementById('open-results');

// e.g. "7 of 10 passed · average 2.6 s · best 2.1 s (1 not seen)"
function resultsSummary() {
  const s = repStats(checkLog);
  let text = `${s.right} of ${s.right + s.wrong} passed`;
  if (s.right) {
    text += ` · average ${secondsText(s.avg)} (FH ${secondsText(s.fh)} · BH ${secondsText(s.bh)})`
      + ` · best ${secondsText(s.best)}`;
  }
  const unseen = checkLog.length - s.right - s.wrong;
  return unseen ? `${text} (${unseen} not seen)` : text;
}

// Right / wrong count and average back-home times for a group of reps.
// Averages are over the right (green) reps, overall and for forehand and
// backhand cues; null if there are none. "Can't see you" reps don't count.
function repStats(reps) {
  const average = list => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);
  const right = reps.filter(e => e.verdict.pass);
  const timesOf = side => right.filter(e => !side || e.side === side).map(e => e.verdict.time);
  return {
    right: right.length,
    wrong: reps.filter(e => e.verdict.pass === false).length,
    avg: average(timesOf()),
    fh: average(timesOf('forehand')),
    bh: average(timesOf('backhand')),
    best: right.length ? Math.min(...timesOf()) : null,
  };
}

function setStats() {
  return [...new Set(checkLog.map(e => e.set))]
    .map(set => ({ set, ...repStats(checkLog.filter(e => e.set === set)) }));
}

const secondsOrDash = v => (v === null ? '–' : v.toFixed(1));
const secondsText = v => (v === null ? '–' : `${v.toFixed(1)} s`);

// The rest screen's table: Set, ✓, ✗, Avg, FH, BH.
function progressTable(sets) {
  const table = document.createElement('table');
  const row = (cells, tag) => {
    const tr = document.createElement('tr');
    for (const text of cells) {
      const cell = document.createElement(tag);
      cell.textContent = text;
      tr.append(cell);
    }
    return tr;
  };
  table.append(row(['Set', '✓', '✗', 'Avg', 'FH', 'BH'], 'th'));
  for (const s of sets) {
    table.append(row([s.set, s.right, s.wrong, secondsOrDash(s.avg), secondsOrDash(s.fh), secondsOrDash(s.bh)], 'td'));
  }
  return table;
}

// For the results list and Copy results, e.g.
// "Set 2   8 right · 2 wrong · avg 2.6 s · FH 2.5 s · BH 2.8 s".
function setSummaries() {
  return setStats().map(s => `Set ${s.set}   ${s.right} right · ${s.wrong} wrong · avg ${secondsText(s.avg)}`
    + ` · FH ${secondsText(s.fh)} · BH ${secondsText(s.bh)}`);
}

function showResults() {
  const sets = setSummaries();
  resultsSummaryText.textContent = resultsSummary() + (sets.length > 1 ? '\n' + sets.join('\n') : '');
  resultsList.replaceChildren(...checkLog.map(entry => {
    const row = document.createElement('div');
    row.className = 'result-entry' + (entry.verdict.pass ? ' passed' : entry.verdict.pass === false ? ' failed' : '');
    const label = document.createElement('strong');
    label.textContent = entry.label;
    row.append(label, '\n' + entry.details);
    return row;
  }));
  homeScreen.hidden = true;
  resultsScreen.hidden = false;
  resultsScreen.scrollTop = 0;
}

document.getElementById('close-results').addEventListener('click', () => {
  resultsScreen.hidden = true;
  homeScreen.hidden = false;
});
openResultsButton.addEventListener('click', showResults);

// Copies the whole list as text, to paste into a chat or a note.
const copyResultsButton = document.getElementById('copy-results');
copyResultsButton.addEventListener('click', async () => {
  const version = document.querySelector('.version').textContent;
  const text = [`Tennis trainer camera results · ${version} · ${settings.handedness}-handed · `
    + `${checkLogPicture} picture`,
    resultsSummary() + (setSummaries().length > 1 ? '\n' + setSummaries().join('\n') : ''),
    ...checkLog.map(entry => `${entry.label}\n${entry.details}\n${entry.numbers}`)].join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Older browsers: copy from a hidden text box instead.
    const box = document.createElement('textarea');
    box.value = text;
    document.body.append(box);
    box.select();
    document.execCommand('copy');
    box.remove();
  }
  copyResultsButton.textContent = 'Copied!';
  setTimeout(() => { copyResultsButton.textContent = 'Copy results'; }, 2000);
});

document.getElementById('open-camera').addEventListener('click', openCamera);
document.getElementById('close-camera').addEventListener('click', closeCamera);

// ---------- Figure test (issue #5, stages 1–2) ----------
// A white stick figure (the opponent, facing you across the net) serves on a
// loop. Each serve goes at random to your forehand or backhand, wide or body
// (from the Settings); the ball flies toward you, then the answer appears as
// the usual triangles. Call out each serve before the answer.

// Easy to tweak after an outdoor test.
const FIGURE = {
  size: 0.85,          // share of the screen height used, bounce to the top of the toss
  lineWidth: 0.05,     // line thickness, share of the figure's height (1 = top of head)
  headSize: 0.075,     // head radius, same unit
  ballSize: 0.04,      // ball radius, same unit
  speed: 1,            // 1 = real serve speed, 0.5 = half speed
  pauseSeconds: 0.5,   // extra time standing still in "ready" after the answer
  answerDelay: 1.0,    // from the ball leaving the screen to the answer
  answerSeconds: 1.5,  // how long the answer (triangles) shows
  wideBounce: 0.85,    // wide bounce: share of the way from the middle to the screen edge,
  wideBounceMax: 1.3,  //   but at most this many figure heights out (wide screens)
  bodyBounce: 0.15,    // body bounce, figure heights from the middle
  toBounceSeconds: 0.7,    // ball flight: hit to bounce (a real serve is about 0.4)
  afterBounceSeconds: 0.6, //   bounce to leaving the screen (real: about 0.25)
};
const FIGURE_TOP = 1.8;       // highest point drawn (the toss), in figure heights
const FIGURE_BOTTOM = 0.3;    // room below the feet for the bounce
const RACKET_LENGTH = 0.38;   // a 69 cm racket for a 1.8 m player
const GRAVITY = 9.81 / 1.8;   // in figure heights per second²

// Saved poses. x = across the screen (+ = your right), y = up from the ground,
// both in figure heights. The figure is right-handed, so facing you its
// racket arm is on your left. "racket" = racket tip; "ball" = ball in the left hand.
const POSES = {
  ready: {
    head: [0, 0.91], neck: [0, 0.83],
    rShoulder: [-0.11, 0.80], rElbow: [-0.17, 0.64], rHand: [-0.14, 0.50], racket: [-0.30, 0.80],
    lShoulder: [0.11, 0.80], lElbow: [0.17, 0.64], lHand: [0.10, 0.56],
    rHip: [-0.07, 0.50], rKnee: [-0.09, 0.27], rFoot: [-0.12, 0],
    lHip: [0.07, 0.50], lKnee: [0.09, 0.27], lFoot: [0.12, 0],
  },
  toss: {      // left arm up, ball let go; racket swinging down and back
    head: [0.01, 0.90], neck: [0, 0.82],
    rShoulder: [-0.11, 0.78], rElbow: [-0.21, 0.65], rHand: [-0.28, 0.51], racket: [-0.45, 0.20],
    lShoulder: [0.11, 0.80], lElbow: [0.13, 0.97], lHand: [0.14, 1.13],
    rHip: [-0.07, 0.48], rKnee: [-0.11, 0.26], rFoot: [-0.12, 0],
    lHip: [0.07, 0.48], lKnee: [0.11, 0.26], lFoot: [0.12, 0],
  },
  back: {      // "trophy": knees bent, racket up behind the head
    head: [0.01, 0.85], neck: [0, 0.77],
    rShoulder: [-0.11, 0.73], rElbow: [-0.27, 0.76], rHand: [-0.27, 0.92], racket: [-0.24, 1.30],
    lShoulder: [0.11, 0.76], lElbow: [0.13, 0.91], lHand: [0.15, 1.07],
    rHip: [-0.07, 0.44], rKnee: [-0.13, 0.24], rFoot: [-0.12, 0],
    lHip: [0.07, 0.44], lKnee: [0.13, 0.24], lFoot: [0.12, 0],
  },
  drop: {      // racket drops behind the back, legs pushing up
    head: [0.01, 0.88], neck: [0, 0.80],
    rShoulder: [-0.11, 0.78], rElbow: [-0.21, 0.97], rHand: [-0.11, 0.90], racket: [-0.05, 0.53],
    lShoulder: [0.11, 0.78], lElbow: [0.18, 0.72], lHand: [0.12, 0.62],
    rHip: [-0.07, 0.48], rKnee: [-0.10, 0.26], rFoot: [-0.12, 0],
    lHip: [0.07, 0.48], lKnee: [0.10, 0.26], lFoot: [0.12, 0],
  },
  hit: {       // fully stretched up, off the ground
    head: [0.02, 0.97], neck: [0, 0.88],
    rShoulder: [-0.10, 0.85], rElbow: [-0.12, 1.02], rHand: [-0.13, 1.18], racket: [-0.11, 1.56],
    lShoulder: [0.11, 0.81], lElbow: [0.16, 0.68], lHand: [0.06, 0.62],
    rHip: [-0.07, 0.54], rKnee: [-0.08, 0.31], rFoot: [-0.10, 0.04],
    lHip: [0.07, 0.54], lKnee: [0.08, 0.31], lFoot: [0.10, 0.05],
  },
  finish: {    // racket down across the body, landed on the left foot
    head: [0.03, 0.88], neck: [0.02, 0.81],
    rShoulder: [-0.08, 0.78], rElbow: [0.02, 0.62], rHand: [0.14, 0.50], racket: [0.32, 0.18],
    lShoulder: [0.12, 0.76], lElbow: [0.21, 0.70], lHand: [0.19, 0.60],
    rHip: [-0.06, 0.50], rKnee: [-0.11, 0.29], rFoot: [-0.15, 0.07],
    lHip: [0.08, 0.50], lKnee: [0.10, 0.27], lFoot: [0.09, 0],
  },
};

// One serve: which pose to reach and when (seconds from the start).
// Holding a pose = the same pose twice in a row.
const SERVE_KEYS = [
  ['ready', 0], ['ready', 1.0], ['toss', 1.6], ['back', 1.95],
  ['drop', 2.15], ['hit', 2.27], ['finish', 2.72], ['finish', 3.3], ['ready', 4.1],
];
const TOSS_AT = 1.6;      // ball leaves the hand
const HIT_AT = 2.27;      // ball meets the racket
const BOUNCE_AT = HIT_AT + FIGURE.toBounceSeconds;        // ball bounces in front of you
const GONE_AT = BOUNCE_AT + FIGURE.afterBounceSeconds;    // ball has left the screen

const FIGURE_BONES = [
  ['neck', 'rShoulder'], ['neck', 'lShoulder'], ['rShoulder', 'rElbow'], ['rElbow', 'rHand'],
  ['lShoulder', 'lElbow'], ['lElbow', 'lHand'], ['rHip', 'lHip'],
  ['rHip', 'rKnee'], ['rKnee', 'rFoot'], ['lHip', 'lKnee'], ['lKnee', 'lFoot'],
];

const figureScreen = document.getElementById('figure-screen');
const figureCanvas = document.getElementById('figure-canvas');
const figureStatus = document.getElementById('figure-status');
const figureAnswer = document.getElementById('figure-answer');
let figureRunning = false;
let figureStart = 0;
let figureServe = -1;   // which serve of the loop is playing (0 = first)
let figureShot = null;  // { side, placement } of that serve

const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const smoothStep = k => k * k * (3 - 2 * k);   // starts and stops gently

// The pose at time t (seconds into the serve), slid between the saved poses.
function poseAt(t) {
  let i = 0;
  while (i < SERVE_KEYS.length - 2 && t >= SERVE_KEYS[i + 1][1]) i++;
  const [fromName, fromTime] = SERVE_KEYS[i];
  const [toName, toTime] = SERVE_KEYS[i + 1];
  const k = smoothStep(Math.min(1, Math.max(0, (t - fromTime) / (toTime - fromTime))));
  const pose = {};
  for (const part in POSES[fromName]) pose[part] = lerp(POSES[fromName][part], POSES[toName][part], k);
  return pose;
}

// Where the racket meets the ball: most of the way up the racket head.
function contactPoint() {
  return lerp(POSES.hit.rHand, POSES.hit.racket, 0.8);
}

// The ball: in the left hand, then a real toss (up and falling back) that
// reaches the contact point exactly at the hit. After the hit it comes toward
// you: down to the bounce, then up and out of the screen, getting bigger as it
// comes closer. side = +1 (your right) or -1; edges = screen edges in figure
// heights. Returns { at, size }, or null when not drawn.
function ballAt(t, pose, shot, side, edges) {
  if (t < TOSS_AT) return { at: [pose.lHand[0], pose.lHand[1] + FIGURE.ballSize], size: FIGURE.ballSize };
  if (t < HIT_AT) {
    const start = poseAt(TOSS_AT).lHand;
    start[1] += FIGURE.ballSize;
    const end = contactPoint();
    const flight = HIT_AT - TOSS_AT;
    const s = t - TOSS_AT;
    const upSpeed = (end[1] - start[1] + GRAVITY * flight * flight / 2) / flight;
    return { at: [start[0] + (end[0] - start[0]) * s / flight,
      start[1] + upSpeed * s - GRAVITY * s * s / 2], size: FIGURE.ballSize };
  }
  if (t >= GONE_AT) return null;

  const wide = shot.placement === 'wide';
  const across = wide ? Math.min(FIGURE.wideBounce * edges.side, FIGURE.wideBounceMax) : FIGURE.bodyBounce;
  const bounce = [side * across, -FIGURE_BOTTOM * 0.7];
  const bounceSize = FIGURE.ballSize * 1.8, outSize = FIGURE.ballSize * 4;
  if (t < BOUNCE_AT) {
    const k = (t - HIT_AT) / (BOUNCE_AT - HIT_AT);
    return { at: lerp(contactPoint(), bounce, k),
      size: FIGURE.ballSize + (bounceSize - FIGURE.ballSize) * k };
  }
  // Wide: out past the side of the screen. Body: out past the bottom, near the middle.
  const out = wide ? [side * (edges.side + outSize), 0.25] : [side * 0.35, edges.bottom - outSize];
  const k = (t - BOUNCE_AT) / (GONE_AT - BOUNCE_AT);
  return { at: lerp(bounce, out, k ** 1.5), size: bounceSize + (outSize - bounceSize) * k };
}

function drawFigure(now) {
  if (!figureRunning) return;
  requestAnimationFrame(drawFigure);

  const ratio = window.devicePixelRatio || 1;
  const width = figureCanvas.clientWidth, height = figureCanvas.clientHeight;
  if (figureCanvas.width !== Math.round(width * ratio)) figureCanvas.width = Math.round(width * ratio);
  if (figureCanvas.height !== Math.round(height * ratio)) figureCanvas.height = Math.round(height * ratio);
  const ctx = figureCanvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // Figure height in pixels, with the whole serve (bounce to toss) on screen.
  const unit = FIGURE.size * height / (FIGURE_TOP + FIGURE_BOTTOM);
  const groundY = (height + FIGURE.size * height) / 2 - FIGURE_BOTTOM * unit;
  const at = ([x, y]) => [width / 2 + x * unit, groundY - y * unit];
  const edges = { side: width / 2 / unit, bottom: (groundY - height) / unit };

  // A new serve (and a new random shot) at the start of each loop.
  const answerAt = GONE_AT + FIGURE.answerDelay;
  const loop = answerAt + FIGURE.answerSeconds + FIGURE.pauseSeconds;
  const elapsed = (now - figureStart) / 1000 * FIGURE.speed;
  const serve = Math.floor(elapsed / loop);
  if (serve !== figureServe) {
    figureServe = serve;
    figureShot = pickShot();
    figureStatus.textContent = `Serve ${serve + 1}`;
  }
  const t = elapsed - serve * loop;
  const pointsRight = (figureShot.side === 'forehand') === (settings.handedness === 'right');

  // The answer: the usual triangles and white frame, figure hidden.
  const answering = t >= answerAt && t < answerAt + FIGURE.answerSeconds;
  figureAnswer.classList.toggle('left', !pointsRight);
  figureAnswer.classList.toggle('wide', figureShot.placement === 'wide');
  figureScreen.classList.toggle('answer', answering);
  if (answering) return;

  const pose = poseAt(t);

  ctx.strokeStyle = ctx.fillStyle = '#fff';
  ctx.lineWidth = FIGURE.lineWidth * unit;
  ctx.lineCap = ctx.lineJoin = 'round';
  const line = (a, b) => {
    ctx.beginPath();
    ctx.moveTo(...at(a));
    ctx.lineTo(...at(b));
    ctx.stroke();
  };
  const dot = (p, r) => {
    ctx.beginPath();
    ctx.arc(...at(p), r * unit, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Body: limbs, then the spine from the neck to between the hips, then the head.
  for (const [a, b] of FIGURE_BONES) line(pose[a], pose[b]);
  line(pose.neck, lerp(pose.rHip, pose.lHip, 0.5));
  dot(pose.head, FIGURE.headSize);

  // Racket: always full length, pointing from the hand toward the saved tip.
  // The handle is a line, the head a filled oval (easier to see than strings).
  const [hx, hy] = pose.rHand;
  const angle = Math.atan2(pose.racket[1] - hy, pose.racket[0] - hx);
  const along = d => [hx + Math.cos(angle) * d, hy + Math.sin(angle) * d];
  line(pose.rHand, along(RACKET_LENGTH * 0.45));
  const [cx, cy] = at(along(RACKET_LENGTH * 0.72));
  ctx.beginPath();
  ctx.ellipse(cx, cy, RACKET_LENGTH * 0.28 * unit, RACKET_LENGTH * 0.19 * unit, -angle, 0, 2 * Math.PI);
  ctx.fill();

  const ball = ballAt(t, pose, figureShot, pointsRight ? 1 : -1, edges);
  if (ball) dot(ball.at, ball.size);
}

function openFigure() {
  homeScreen.hidden = true;
  figureScreen.hidden = false;
  keepAwake();
  figureRunning = true;
  figureStart = performance.now();
  figureServe = -1;
  requestAnimationFrame(drawFigure);
}

function closeFigure() {
  figureRunning = false;
  figureScreen.classList.remove('answer');
  allowSleep();
  figureScreen.hidden = true;
  homeScreen.hidden = false;
}

document.getElementById('open-figure').addEventListener('click', openFigure);
document.getElementById('close-figure').addEventListener('click', closeFigure);

// ---------- Start-up ----------
loadSaved();
showMode();

// Save the app's files on the phone so it also works with no signal.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode not available:', err));
}
