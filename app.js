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
  shortDeep: false,        // tilt the arrow up (short) or down (deep)
  shortPercent: 33,        // share of short cues (only used when shortDeep is on);
  deepPercent: 33,         // the rest are neutral (flat arrow)
  repsPerSet: 10,
  sets: 3,
  restSeconds: 60,
  syncOffsetMs: 0,         // + shows the screen later, - plays the voice later
  cameraCheck: false,      // watch with the camera and show what it saw (Return/Volley)
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
  { key: 'shortPercent', label: 'Short (tilted up)', min: 0, max: 100, step: 1,
    show: v => `${v}% short` },
  { key: 'deepPercent', label: 'Deep (tilted down)', min: 0, max: 100, step: 1,
    show: v => `${v}% deep · ${100 - settings.shortPercent - v}% neutral (flat)`,
    hint: 'Neutral = whatever is left: stay at the same depth.' },
  { key: 'repsPerSet', label: 'Reps per set', min: 1, max: 30, step: 1,
    show: v => `${v} reps` },
  { key: 'sets', label: 'Sets', min: 1, max: 10, step: 1,
    show: v => (v === 1 ? '1 set' : `${v} sets`) },
  { key: 'restSeconds', label: 'Rest between sets', min: 10, max: 180, step: 10,
    show: v => formatClock(v) },
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
    // Before v1.9 there was no neutral: short was simply 100% minus deep.
    // Such saves start on the new short / neutral / deep defaults.
    if (saved.settings && saved.settings.shortPercent === undefined) {
      settings.shortPercent = DEFAULT_SETTINGS.shortPercent;
      settings.deepPercent = DEFAULT_SETTINGS.deepPercent;
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
const arrow = document.getElementById('arrow');
const arrowShape = document.getElementById('arrow-shape');
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
    // null = flat arrow (short/deep switched off, or a neutral cue)
    length: settings.shortDeep ? pickLength() : null,
  };
}

function pickLength() {
  const roll = Math.random() * 100;
  if (roll < settings.shortPercent) return 'short';
  if (roll < settings.shortPercent + settings.deepPercent) return 'deep';
  return null;
}

// How the sign (one triangle for body, two for wide) is tilted for each
// length. The frame (viewBox) fits tightly around the tilted wide sign, so
// it is drawn nearly as big as the flat one. Body uses the same frame, so
// its triangle is exactly the same size as each wide one.
const ARROW_TILT = {
  flat:  { rotate: 0,   viewBox: '0 0 100 100' },
  short: { rotate: -45, viewBox: '-20.8 11.7 109.1 109.1' },   // points up (move forward)
  deep:  { rotate: 45,  viewBox: '-20.8 -20.8 109.1 109.1' },  // points down (move back)
};

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

  const tilt = ARROW_TILT[shot.length || 'flat'];
  const paint = () => {
    arrow.setAttribute('viewBox', tilt.viewBox);
    arrowShape.setAttribute('transform', `rotate(${tilt.rotate} 50 50)`);
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

// Neutral screen, random wait, beep, gap, cue. Used by all three modes.
// Returns the shot that was cued (nothing if the session was ended).
async function serveRep(run, gapSeconds) {
  showScreen('neutral');
  await wait(randomBetween(TIMING.minWaitSeconds, TIMING.maxWaitSeconds));
  if (run.stopped) return;

  beep();                              // split-step trigger
  await waitExactly(gapSeconds);
  if (run.stopped) return;

  const shot = pickShot();
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
async function rest(run, nextSet) {
  showScreen('rest');
  statusText.textContent = `Rest · next: set ${nextSet}/${settings.sets}`;
  for (let left = settings.restSeconds; left > 0; left--) {
    messageText.textContent = formatClock(left);
    if (left === TIMING.restWarningSeconds) beep();
    await wait(1);
    if (run.stopped) return;
  }
  messageText.textContent = '';
}

const repForMode = { return: returnRep, volley: volleyRep, rally: rallyRep };

async function runSession() {
  const run = { stopped: false };
  currentRun = run;
  messageText.textContent = '';
  const doRep = repForMode[mode];

  for (let set = 1; set <= settings.sets; set++) {
    for (let rep = 1; rep <= settings.repsPerSet; rep++) {
      Object.assign(run, { set, rep });
      statusText.textContent = `Set ${set}/${settings.sets} · Rep ${rep}/${settings.repsPerSet}`;
      await doRep(run);
      if (run.stopped) return;
    }
    if (set < settings.sets) {
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
startButton.addEventListener('click', async () => {
  startButton.disabled = true;
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
    return;
  }
  // Camera check: Return and Volley only (rally cues come too fast).
  if (settings.cameraCheck && mode !== 'rally') {
    checkLog.length = 0;
    cameraUse = 'session';
    try {
      await startCamera(text => { loadStatus.textContent = text; });
      loadStatus.textContent = '';
    } catch (err) {
      loadStatus.textContent = `${err.message}\nOr turn off Camera check in Settings.`;
      allowSleep();
      startButton.disabled = false;
      return;
    }
  }
  startButton.disabled = false;
  homeScreen.hidden = true;
  sessionScreen.hidden = false;
  runSession();
});

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
    if (slider.key === 'shortPercent' || slider.key === 'deepPercent') keepDepthsUnder100(slider.key);
    value.textContent = slider.show(settings[slider.key]);
    save();
  });
  sliderInputs[slider.key] = { input, value, slider, row };
  document.getElementById('sliders').append(row);
}

// Short + deep can't be more than 100%: moving one slider pulls the other
// down if needed. Both show again, because the deep one also shows neutral.
function keepDepthsUnder100(moved) {
  const other = moved === 'shortPercent' ? 'deepPercent' : 'shortPercent';
  settings[other] = Math.min(settings[other], 100 - settings[moved]);
  for (const key of ['shortPercent', 'deepPercent']) {
    const { input, value, slider } = sliderInputs[key];
    input.value = settings[key];
    value.textContent = slider.show(settings[key]);
  }
}

// Short / deep on/off, placed just above its sliders. The sliders are hidden
// while it's off.
const shortDeepButtons = document.querySelectorAll('.short-deep-button');
const depthSliderRows = [sliderInputs.shortPercent.row, sliderInputs.deepPercent.row];
depthSliderRows[0].before(document.getElementById('short-deep-toggle'));

function showShortDeep() {
  for (const button of shortDeepButtons) {
    button.classList.toggle('selected', button.dataset.on === String(settings.shortDeep));
  }
  for (const row of depthSliderRows) row.hidden = !settings.shortDeep;
}

for (const button of shortDeepButtons) {
  button.addEventListener('click', () => {
    settings.shortDeep = button.dataset.on === 'true';
    showShortDeep();
    save();
  });
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

function showCameraCheck() {
  for (const button of cameraCheckButtons) {
    button.classList.toggle('selected', button.dataset.on === String(settings.cameraCheck));
  }
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
  showShortDeep();
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
  maxWatchSeconds: 6,      // show the result by then, even if you're not back home
  resultSeconds: 5,        // how long the big result shows during play
  minVisibility: 0.5,      // how sure the tracker must be that it sees a body point
  minSamples: 3,           // fewer pictures than this = "Couldn't see you"
  minMove: 0.25,           // sideways move smaller than this (shoulder widths) = stayed
  bigMove: 1.0,            // sideways move at least this = big, otherwise small
  minDepthPercent: 8,      // closer/further less than this = same
  swingReach: 0.5,         // a swing: the hitting wrist goes from this far on one side
                           // of the chest centre (shoulder widths) to this far on the other,
  swingSeconds: 0.6,       // within this time
  homeDistance: 0.33,      // back home: hips this close to the start spot (shoulder widths)
  homeHoldSeconds: 0.2,    // and staying there this long
  keepSeconds: 8,          // forget body positions older than this
};

// Body positions seen during a session, newest last.
const samples = [];
// Every rep's full result, shown in the results list after the session.
// Kept until the next session with Camera check starts.
const checkLog = [];

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
      // Shoulders to hips: hardly changes when you turn, but grows as you come closer.
      torso: Math.hypot(shoulders.x - hips.x, shoulders.y - hips.y),
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
    torso: average(before, s => s.torso),
    rightward: Math.sign(average(before, s => s.rightward)) || 1,
  };
  // + = toward the player's right, in shoulder widths
  const sideways = smooth(after.map(s => (s.hips.x - start.x) * start.rightward / start.shoulderWidth));
  // + = came closer (looks bigger), as a share of the start size
  const depth = smooth(after.map(s => s.torso / start.torso - 1));
  // Hitting wrist across the body: + = on the player's right of the chest centre
  const across = smooth(after.map(s => (s.wrist.x - s.shoulders.x) * start.rightward / start.shoulderWidth), 1);
  const times = after.map(s => s.time);

  const swing = findSwing(across, times);
  return {
    sideways: furthest(sideways),
    depth: furthest(depth),
    swing,
    homeAt: swing ? findHome(sideways, depth, times, swing.at) : null,
  };
}

// The first quick sweep of the hitting wrist from one side of the body to the
// other. From the hitting side to the other side = forehand; the other way =
// backhand (one- or two-handed).
function findSwing(across, times) {
  let lastRight = null, lastLeft = null;   // when the wrist was last far out on each side
  for (let i = 0; i < across.length; i++) {
    const t = times[i];
    if (across[i] >= CAMERA.swingReach) {
      if (lastLeft !== null && t - lastLeft <= CAMERA.swingSeconds * 1000) return swingFrom(-1, t);
      lastRight = t;
    } else if (across[i] <= -CAMERA.swingReach) {
      if (lastRight !== null && t - lastRight <= CAMERA.swingSeconds * 1000) return swingFrom(1, t);
      lastLeft = t;
    }
  }
  return null;
}

function swingFrom(side, at) {
  const hittingSide = settings.handedness === 'right' ? 1 : -1;
  return { side: side === hittingSide ? 'forehand' : 'backhand', at };
}

// The first moment after the swing when the hips are back near the start spot
// (sideways and forward/back) and stay there for a moment. null = not yet.
function findHome(sideways, depth, times, after) {
  const near = i => Math.abs(sideways[i]) <= CAMERA.homeDistance
                 && Math.abs(depth[i]) * 100 < CAMERA.minDepthPercent;
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
  const percent = Math.round(Math.abs(result.depth) * 100);
  return {
    size,
    side: result.sideways > 0 ? 'right' : 'left',
    stayed: size < CAMERA.minMove,
    big: size >= CAMERA.bigMove,
    percent,
    depth: percent < CAMERA.minDepthPercent ? 'same' : result.depth > 0 ? 'closer' : 'further',
  };
}

function cueName(shot) {
  const depth = shot.length || (settings.shortDeep ? 'neutral' : '');
  return `${shot.side} ${shot.placement}${depth ? ' ' + depth : ''}`;
}

// A few huge words, readable from a few metres away during play.
function bigResult(result) {
  if (!result) return 'CAN’T SEE YOU';
  const r = readings(result);
  const lines = [r.stayed ? 'NO SIDE STEP' : `${r.big ? 'BIG' : 'SMALL'} STEP ${r.side.toUpperCase()}`];
  if (settings.shortDeep) {
    lines.push({ same: 'SAME DEPTH', closer: 'STEP FORWARD', further: 'STEP BACK' }[r.depth]);
  }
  if (!result.swing) {
    lines.push('NO SWING');
  } else {
    lines.push(result.swing.side.toUpperCase());
    lines.push(result.homeAt ? `BACK IN ${seconds(result.homeAt)} s` : 'NOT BACK');
  }
  return lines.join('\n');
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
  lines.push(`Forward/back: ${r.depth} ${r.percent}%`);
  if (!result.swing) {
    lines.push('Swing: none seen');
    lines.push('Back home: no time (no swing)');
  } else {
    lines.push(`Swing: ${result.swing.side} (at ${seconds(result.swing.at)} s)`);
    lines.push(result.homeAt ? `Back home: ${seconds(result.homeAt)} s`
      : `Back home: not within ${CAMERA.maxWatchSeconds} s`);
  }
  return lines.join('\n');
}

// Time since the cue, e.g. "2.1".
function seconds(time) { return ((time - cueShownAt) / 1000).toFixed(1); }

// After a Return or Volley cue: keep watching until you are back home after
// your swing (at most maxWatchSeconds after the cue), then show what the
// camera saw.
async function showCheck(run, shot) {
  if (!shot || cameraUse !== 'session' || run.stopped) return;
  showScreen('neutral');
  const end = cueShownAt + CAMERA.maxWatchSeconds * 1000;
  while (performance.now() < end && !analyseRep(cueShownAt, performance.now())?.homeAt) {
    await waitExactly(0.1);
    if (run.stopped) return;
  }
  const result = analyseRep(cueShownAt, Math.min(performance.now(), end));
  checkLog.push({ label: `Set ${run.set} · Rep ${run.rep}`, details: describeResult(shot, result) });
  messageText.textContent = bigResult(result);
  showScreen('result');
  await wait(CAMERA.resultSeconds);
  messageText.textContent = '';
}

// ---------- Results list (after a session with Camera check) ----------
const resultsScreen = document.getElementById('results-screen');
const resultsList = document.getElementById('results-list');
const openResultsButton = document.getElementById('open-results');

function showResults() {
  resultsList.replaceChildren(...checkLog.map(entry => {
    const row = document.createElement('div');
    row.className = 'result-entry';
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

document.getElementById('open-camera').addEventListener('click', openCamera);
document.getElementById('close-camera').addEventListener('click', closeCamera);

// ---------- Start-up ----------
loadSaved();
showMode();

// Save the app's files on the phone so it also works with no signal.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode not available:', err));
}
