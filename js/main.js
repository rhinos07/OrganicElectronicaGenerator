// User interface and real-time playback.

import { Composer } from './composer.js';
import { AudioEngine, MIXER_GROUPS } from './engine.js';
import { Sequencer, renderOffline, encodeWav } from './sequencer.js';
import { STYLES, STYLE_ORDER } from './styles.js';
import { NOTE_NAMES } from './theory.js';
import { randomSeed } from './random.js';
import { Visualizer } from './visual.js';

const LAYER_LABELS = {
  drums: 'Drums', perc: 'Percussion', gears: 'Bells & kalimba', bass: 'Bass',
  keys: 'Rhodes', pad: 'Pad', lead: 'Lead', texture: 'Texture',
};
const STORAGE_KEY = 'organic-electronica-settings';

// ---------------------------------------------------------------------------
// Settings

function loadSettings() {
  const defaults = {
    style: 'organic', bpm: STYLES.organic.bpm, key: 9, energy: 0.65, volume: 0.8,
    seed: randomSeed(), mutes: Object.fromEntries(MIXER_GROUPS.map((g) => [g, false])),
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const merged = { ...defaults, ...saved, mutes: { ...defaults.mutes, ...(saved.mutes || {}) } };
    if (!STYLES[merged.style]) merged.style = defaults.style;
    return merged;
  } catch {
    return defaults;
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode). Settings then last for this visit only.
  }
}

const settings = loadSettings();

// ---------------------------------------------------------------------------
// Real-time player

// A timer in a worker keeps running when the tab is in the background.
const TIMER_SOURCE = 'let id; onmessage = (e) => { clearInterval(id); if (e.data > 0) id = setInterval(() => postMessage(0), e.data); };';

class Player {
  constructor(onInfo) {
    this.ctx = null;
    this.engine = null;
    this.composer = null;
    this.sequencer = null;
    this.playing = false;
    this.onInfo = onInfo;
    this.timer = new Worker(URL.createObjectURL(new Blob([TIMER_SOURCE], { type: 'text/javascript' })));
    this.timer.onmessage = () => this.tick();
    this.muted = false;
  }

  async start() {
    if (!this.ctx) this.ctx = new AudioContext({ latencyHint: 'playback' });
    await this.ctx.resume();
    this.engine = new AudioEngine(this.ctx);
    this.engine.master.gain.value = this.muted ? 0 : settings.volume;
    for (const group of MIXER_GROUPS) this.engine.setMuted(group, settings.mutes[group]);

    if (!this.composer) {
      this.composer = new Composer(settings);
    } else {
      this.composer.setStyle(settings.style);
      this.composer.setKey(settings.key);
      this.composer.setEnergy(settings.energy);
    }
    this.sequencer = new Sequencer(this.engine, this.composer, {
      bpm: settings.bpm,
      onInfo: (info, time) => {
        const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
        setTimeout(() => this.playing && this.onInfo(info), delay);
      },
    });
    this.sequencer.start(this.ctx.currentTime + 0.12);
    this.playing = true;
    this.tick();
    this.timer.postMessage(25);
  }

  stop() {
    this.timer.postMessage(0);
    this.playing = false;
    if (this.engine) this.engine.dispose();
    this.engine = null;
    this.sequencer = null;
  }

  tick() {
    if (!this.playing) return;
    // Schedule further ahead in the background, where timers are less precise.
    const ahead = document.hidden ? 1.5 : 0.25;
    this.sequencer.scheduleUntil(this.ctx.currentTime + ahead);
  }

  get analyser() {
    return this.engine ? this.engine.analyser : null;
  }
}

// ---------------------------------------------------------------------------
// User interface

const $ = (id) => document.getElementById(id);
const visual = new Visualizer($('visual'));
const player = new Player(showInfo);

function showInfo(info) {
  $('now').textContent = `${info.styleName} · ${info.section} ${info.bar}/${info.bars} · ${info.chord} · Track ${info.song}`;
}

function buildStyleButtons() {
  const box = $('styles');
  STYLE_ORDER.forEach((id, index) => {
    const style = STYLES[id];
    const b = document.createElement('button');
    b.setAttribute('role', 'radio');
    b.dataset.style = id;
    b.title = `${style.description} (key ${index + 1})`;
    b.innerHTML = `${style.name}<small>${style.bpm} BPM</small>`;
    b.addEventListener('click', () => selectStyle(id));
    box.append(b);
  });
}

function buildLayerButtons() {
  const box = $('layers');
  for (const group of MIXER_GROUPS) {
    const b = document.createElement('button');
    b.textContent = LAYER_LABELS[group];
    b.dataset.group = group;
    b.addEventListener('click', () => {
      settings.mutes[group] = !settings.mutes[group];
      if (player.engine) player.engine.setMuted(group, settings.mutes[group]);
      updateUi();
      saveSettings();
    });
    box.append(b);
  }
}

function buildKeySelect() {
  NOTE_NAMES.forEach((name, pc) => {
    const o = document.createElement('option');
    o.value = pc;
    o.textContent = `${name} minor`;
    $('key').append(o);
  });
}

function selectStyle(id) {
  if (!STYLES[id]) return;
  settings.style = id;
  settings.bpm = STYLES[id].bpm;
  if (player.composer) player.composer.setStyle(id);
  if (player.sequencer) player.sequencer.setTempo(settings.bpm);
  updateUi();
  saveSettings();
}

function updateUi() {
  const style = STYLES[settings.style];
  document.body.dataset.style = settings.style;
  document.body.classList.toggle('playing', player.playing);
  $('play').setAttribute('aria-label', player.playing ? 'Stop' : 'Play');
  for (const b of $('styles').children) b.setAttribute('aria-checked', String(b.dataset.style === settings.style));
  for (const b of $('layers').children) b.setAttribute('aria-pressed', String(!settings.mutes[b.dataset.group]));

  const tempo = $('tempo');
  tempo.min = style.bpmMin;
  tempo.max = style.bpmMax;
  tempo.value = settings.bpm;
  $('tempo-value').textContent = `${settings.bpm} BPM`;
  $('key').value = settings.key;
  $('energy').value = Math.round(settings.energy * 100);
  $('energy-value').textContent = `${Math.round(settings.energy * 100)} %`;
  $('volume').value = Math.round(settings.volume * 100);
  $('volume-value').textContent = player.muted ? 'muted' : `${Math.round(settings.volume * 100)} %`;
  visual.setPalette(style.palette);
  document.querySelector('meta[name="theme-color"]').content = style.palette.bg;
}

async function togglePlay() {
  if (player.playing) {
    player.stop();
    $('now').textContent = 'Stopped';
  } else {
    try {
      await player.start();
      visual.setAnalyser(player.analyser);
    } catch (error) {
      console.error(error);
      $('status').textContent = `Audio could not start: ${error.message}`;
    }
  }
  updateMediaSession();
  updateUi();
}

function newVariation() {
  settings.seed = randomSeed();
  if (player.composer) player.composer.newVariation(settings.seed);
  $('status').textContent = 'New variation from the next bar';
  setTimeout(() => ($('status').textContent = ''), 2500);
  saveSettings();
}

function toggleMute() {
  player.muted = !player.muted;
  if (player.engine) player.engine.setVolume(player.muted ? 0 : settings.volume);
  updateUi();
}

async function exportWav() {
  const seconds = Number($('export-length').value);
  const button = $('export');
  button.disabled = true;
  const status = $('status');
  status.textContent = 'Rendering… 0 %';
  try {
    const buffer = await renderOffline({ ...settings }, seconds, (p) => {
      status.textContent = `Rendering… ${Math.round(p * 100)} %`;
    });
    const url = URL.createObjectURL(encodeWav(buffer));
    const a = document.createElement('a');
    a.href = url;
    a.download = `organic-electronica-${settings.style}-${settings.seed}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = 'Export finished';
  } catch (error) {
    console.error(error);
    status.textContent = `Export failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: STYLES[settings.style].name,
    artist: 'Organic Electronica Generator',
  });
  navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
  navigator.mediaSession.setActionHandler('play', () => !player.playing && togglePlay());
  navigator.mediaSession.setActionHandler('pause', () => player.playing && togglePlay());
  navigator.mediaSession.setActionHandler('nexttrack', newVariation);
}

function bindControls() {
  $('play').addEventListener('click', togglePlay);
  $('variation').addEventListener('click', newVariation);
  $('export').addEventListener('click', exportWav);
  $('tempo').addEventListener('input', (e) => {
    settings.bpm = Number(e.target.value);
    if (player.sequencer) player.sequencer.setTempo(settings.bpm);
    updateUi();
    saveSettings();
  });
  $('key').addEventListener('change', (e) => {
    settings.key = Number(e.target.value);
    if (player.composer) player.composer.setKey(settings.key);
    saveSettings();
  });
  $('energy').addEventListener('input', (e) => {
    settings.energy = Number(e.target.value) / 100;
    if (player.composer) player.composer.setEnergy(settings.energy);
    updateUi();
    saveSettings();
  });
  $('volume').addEventListener('input', (e) => {
    settings.volume = Number(e.target.value) / 100;
    player.muted = false;
    if (player.engine) player.engine.setVolume(settings.volume);
    updateUi();
    saveSettings();
  });

  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Form controls keep their own keyboard behavior.
    if (e.target.closest('input, select')) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (k === 'n') newVariation();
    else if (k === 'm') toggleMute();
    else if (k === 'h') $('panel').classList.toggle('hidden');
    else if (['1', '2', '3'].includes(k)) selectStyle(STYLE_ORDER[Number(k) - 1]);
  });
  // Space always means play/stop: do not let it also click a focused button.
  addEventListener('keyup', (e) => {
    if (e.key === ' ' && e.target.closest('button')) e.preventDefault();
  });
}

buildStyleButtons();
buildLayerButtons();
buildKeySelect();
bindControls();
updateUi();
visual.start();
