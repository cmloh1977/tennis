'use strict';

// ---------- Settings (a settings screen comes in a later step) ----------
const settings = {
  handedness: 'right',   // 'right' or 'left': flips which way the arrows point
  gapSeconds: 0.7,       // difficulty: time between the beep and the cue
  volleyGapFactor: 0.6,  // Volley uses 60% of the gap (balls arrive faster at the net)
  minWaitSeconds: 3,     // random wait before the beep
  maxWaitSeconds: 5,
  cueSeconds: 1.5,       // how long the cue stays on screen
  rallyMinSeconds: 2,    // rally tempo: time from one rally cue to the next
  rallyMaxSeconds: 3,
  rallyMinShots: 2,      // the rally stops after a random number of shots,
  rallyMaxShots: 8,      // counting the return
  tickLeadSeconds: 0.5,  // the tick comes this long before each rally cue
  stopSeconds: 2,        // how long the STOP screen shows
  backhandPercent: 50,   // forehand/backhand balance
  widePercent: 50,       // wide/body mix
  repsPerSet: 10,
  syncOffsetMs: 0,       // + shows the screen later, - plays the voice later
};

// Add ?fast=1 to the address to shrink all waits (for quick testing).
const FAST = new URLSearchParams(location.search).has('fast');
const speed = FAST ? 0.25 : 1;

// ---------- Screen elements ----------
const homeScreen = document.getElementById('home');
const sessionScreen = document.getElementById('session');
const startButton = document.getElementById('start');
const endButton = document.getElementById('end');
const statusText = document.getElementById('status');
const messageText = document.getElementById('message');
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
let wakeLock = null;

async function keepAwake() {
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('Wake lock not available:', err);
  }
}

function allowSleep() {
  if (wakeLock) wakeLock.release();
  wakeLock = null;
}

// The wake lock is dropped when the app is hidden, so ask again on return.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && currentRun) keepAwake();
});

// ---------- Cues ----------
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function randomWhole(min, max) { return Math.floor(randomBetween(min, max + 1)); }

function pickShot() {
  return {
    side: Math.random() * 100 < settings.backhandPercent ? 'backhand' : 'forehand',
    depth: Math.random() * 100 < settings.widePercent ? 'wide' : 'body',
  };
}

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
  voice.buffer = voices[shot.depth];
  voice.connect(audio.destination);
  // If the screen should come first (negative offset), delay the voice instead.
  voice.start(audio.currentTime + Math.max(0, -screenDelayMs) / 1000);

  const paint = () => {
    arrow.classList.toggle('left', !pointsRight);
    showScreen(shot.side);
  };
  if (screenDelayMs > 0) setTimeout(paint, screenDelayMs);
  else paint();
}

// ---------- Running a session ----------
// currentRun is replaced each time Start is pressed; End marks it stopped.
let currentRun = null;
let mode = 'return';   // 'return', 'volley' or 'rally'

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
  await wait(randomBetween(settings.minWaitSeconds, settings.maxWaitSeconds));
  if (run.stopped) return;

  beep();                              // split-step trigger
  await waitExactly(gapSeconds);
  if (run.stopped) return;

  showCue(pickShot());
}

async function returnRep(run) {
  await serveRep(run, settings.gapSeconds);
  await wait(settings.cueSeconds);
}

async function volleyRep(run) {
  await serveRep(run, settings.gapSeconds * settings.volleyGapFactor);
  await wait(settings.cueSeconds);
}

// The return, then a new cue every few seconds (each after a tick), until the
// rally stops at a random shot with a white STOP screen.
async function rallyRep(run) {
  const totalShots = randomWhole(settings.rallyMinShots, settings.rallyMaxShots);
  await serveRep(run, settings.gapSeconds);

  for (let shot = 2; shot <= totalShots; shot++) {
    const interval = randomBetween(settings.rallyMinSeconds, settings.rallyMaxSeconds);
    // Go back to neutral between cues, so two cues in a row on the same side
    // still look like two separate cues.
    const cueOnScreen = Math.min(settings.cueSeconds, interval - settings.tickLeadSeconds - 0.3);
    await waitExactly(cueOnScreen);
    if (run.stopped) return;
    showScreen('neutral');

    await waitExactly(interval - cueOnScreen - settings.tickLeadSeconds);
    if (run.stopped) return;
    tick();
    await waitExactly(settings.tickLeadSeconds);
    if (run.stopped) return;
    showCue(pickShot());
  }

  await waitExactly(Math.min(settings.cueSeconds, settings.rallyMinSeconds));
  if (run.stopped) return;
  messageText.textContent = 'STOP';
  showScreen('stop');
  await wait(settings.stopSeconds);
  messageText.textContent = '';
}

const repForMode = { return: returnRep, volley: volleyRep, rally: rallyRep };

async function runSession() {
  const run = { stopped: false };
  currentRun = run;
  messageText.textContent = '';
  const doRep = repForMode[mode];

  for (let rep = 1; rep <= settings.repsPerSet; rep++) {
    statusText.textContent = `Rep ${rep} / ${settings.repsPerSet}`;
    await doRep(run);
    if (run.stopped) return;
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
  loadStatus.textContent = 'Loading sounds…';
  try {
    await setUpAudio();
    loadStatus.textContent = '';
  } catch (err) {
    loadStatus.textContent = 'Could not load sounds. Check your connection and try again.';
    console.error(err);
    audio = null;
    startButton.disabled = false;
    return;
  }
  startButton.disabled = false;
  keepAwake();
  homeScreen.hidden = true;
  sessionScreen.hidden = false;
  runSession();
});

endButton.addEventListener('click', endSession);

for (const button of document.querySelectorAll('.mode-button')) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode;
    for (const other of document.querySelectorAll('.mode-button')) {
      other.classList.toggle('selected', other === button);
    }
  });
}
