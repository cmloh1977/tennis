'use strict';

// ---------- Settings (a settings screen comes in a later step) ----------
const settings = {
  handedness: 'right',   // 'right' or 'left': flips which way the arrows point
  gapSeconds: 0.7,       // difficulty: time between the beep and the cue
  minWaitSeconds: 3,     // random wait before the beep
  maxWaitSeconds: 5,
  cueSeconds: 1.5,       // how long the cue stays on screen
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

function wait(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000 * speed));
}

async function returnRep(run) {
  showScreen('neutral');
  await wait(randomBetween(settings.minWaitSeconds, settings.maxWaitSeconds));
  if (run.stopped) return;

  beep();                              // split-step trigger
  // The gap is the drill itself, so it is never shortened by ?fast=1.
  await new Promise(resolve => setTimeout(resolve, settings.gapSeconds * 1000));
  if (run.stopped) return;

  showCue(pickShot());
  await wait(settings.cueSeconds);
}

async function runSession() {
  const run = { stopped: false };
  currentRun = run;
  messageText.textContent = '';

  for (let rep = 1; rep <= settings.repsPerSet; rep++) {
    statusText.textContent = `Rep ${rep} / ${settings.repsPerSet}`;
    await returnRep(run);
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
