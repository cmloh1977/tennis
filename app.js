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
  shortDeep: false,        // tilt the arrow up (short) or down (deep)
  deepPercent: 50,         // short/deep mix (only used when shortDeep is on)
  repsPerSet: 10,
  sets: 3,
  restSeconds: 60,
  syncOffsetMs: 0,         // + shows the screen later, - plays the voice later
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
  { key: 'deepPercent', label: 'Short / deep', min: 0, max: 100, step: 10,
    show: v => `${100 - v}% short · ${v}% deep` },
  { key: 'repsPerSet', label: 'Reps per set', min: 1, max: 30, step: 1,
    show: v => `${v} reps` },
  { key: 'sets', label: 'Sets', min: 1, max: 10, step: 1,
    show: v => (v === 1 ? '1 set' : `${v} sets`) },
  { key: 'restSeconds', label: 'Rest between sets', min: 10, max: 180, step: 10,
    show: v => formatClock(v) },
  { key: 'syncOffsetMs', label: 'Sound / screen sync', min: -150, max: 150, step: 10,
    show: v => (v === 0 ? 'no adjustment'
      : v > 0 ? `screen ${v} ms later` : `voice ${-v} ms later`),
    hint: 'Only change this if the voice and the colour don’t arrive together.' },
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
  if (document.visibilityState === 'visible' && currentRun) keepAwake();
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
    // null = flat arrow (short/deep switched off)
    length: !settings.shortDeep ? null
      : Math.random() * 100 < settings.deepPercent ? 'deep' : 'short',
  };
}

// How the arrow is tilted for each length. The frame (viewBox) fits tightly
// around the tilted arrow, so it is drawn as big as the flat one, or bigger.
const ARROW_TILT = {
  flat:  { rotate: 0,   viewBox: '0 0 100 100' },
  short: { rotate: -45, viewBox: '0.5 14.6 84.9 84.9' },  // points up (move forward)
  deep:  { rotate: 45,  viewBox: '0.5 0.5 84.9 84.9' },   // points down (move back)
};

function showScreen(name) {
  sessionScreen.className = 'screen ' + name;
}

// Shows the colour + arrow and plays the voice so they arrive together.
// The phone may report a delay before sound reaches the speaker; if so, the
// screen change is held back by that amount. syncOffsetMs fine-tunes it.
function showCue(shot) {
  const pointsRight = (shot.side === 'forehand') === (settings.handedness === 'right');
  const speakerDelayMs = ((audio.outputLatency || audio.baseLatency || 0) * 1000);
  const screenDelayMs = speakerDelayMs + settings.syncOffsetMs;

  const voice = audio.createBufferSource();
  voice.buffer = voices[shot.placement];
  voice.connect(audio.destination);
  // If the screen should come first (negative offset), delay the voice instead.
  voice.start(audio.currentTime + Math.max(0, -screenDelayMs) / 1000);

  const tilt = ARROW_TILT[shot.length || 'flat'];
  const paint = () => {
    arrow.setAttribute('viewBox', tilt.viewBox);
    arrowShape.setAttribute('transform', `rotate(${tilt.rotate} 50 50)`);
    arrow.classList.toggle('left', !pointsRight);
    showScreen(shot.side);
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
async function serveRep(run, gapSeconds) {
  showScreen('neutral');
  await wait(randomBetween(TIMING.minWaitSeconds, TIMING.maxWaitSeconds));
  if (run.stopped) return;

  beep();                              // split-step trigger
  await waitExactly(gapSeconds);
  if (run.stopped) return;

  showCue(pickShot());
}

async function returnRep(run) {
  await serveRep(run, settings.gapSeconds);
  await wait(TIMING.cueSeconds);
}

async function volleyRep(run) {
  await serveRep(run, settings.gapSeconds * TIMING.volleyGapFactor);
  await wait(TIMING.cueSeconds);
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
  messageText.textContent = '';
  showScreen('neutral');
  sessionScreen.hidden = true;
  homeScreen.hidden = false;
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
    value.textContent = slider.show(settings[slider.key]);
    save();
  });
  sliderInputs[slider.key] = { input, value, slider, row };
  document.getElementById('sliders').append(row);
}

// Short / deep on/off, placed just above its slider. The slider is hidden
// while it's off.
const shortDeepButtons = document.querySelectorAll('.short-deep-button');
const deepSliderRow = sliderInputs.deepPercent.row;
deepSliderRow.before(document.getElementById('short-deep-toggle'));

function showShortDeep() {
  for (const button of shortDeepButtons) {
    button.classList.toggle('selected', button.dataset.on === String(settings.shortDeep));
  }
  deepSliderRow.hidden = !settings.shortDeep;
}

for (const button of shortDeepButtons) {
  button.addEventListener('click', () => {
    settings.shortDeep = button.dataset.on === 'true';
    showShortDeep();
    save();
  });
}

function showSettings() {
  showHandedness();
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

// ---------- Start-up ----------
loadSaved();
showMode();

// Save the app's files on the phone so it also works with no signal.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline mode not available:', err));
}
