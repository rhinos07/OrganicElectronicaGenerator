// Synthesized instruments. Every voice is built from oscillators, noise and
// filters, so the project needs no audio samples.
//
// Signature of every voice: (engine, destination, time, event, stepDuration)

import { midiToFreq } from './theory.js';

// ---------------------------------------------------------------------------
// Helpers

function oscillator(ctx, type, frequency, time) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(frequency, time);
  return o;
}

function gainNode(ctx, value = 0) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function filterNode(ctx, type, frequency, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** Percussive envelope: fast attack, exponential decay (time constant tau). */
function percEnvelope(param, time, peak, attack, tau) {
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(peak, time + attack);
  param.setTargetAtTime(0, time + attack, tau);
}

function noiseSource(engine, time, duration) {
  const s = engine.ctx.createBufferSource();
  s.buffer = engine.noise;
  s.loop = true;
  s.start(time, Math.random() * (engine.noise.duration - 0.1));
  s.stop(time + duration);
  return s;
}

function playOsc(o, time, duration) {
  o.start(time);
  o.stop(time + duration);
  return o;
}

/** A sine partial with its own decay, used for mallets and bells. */
function partial(ctx, out, time, frequency, peak, tau, attack = 0.002) {
  const o = oscillator(ctx, 'sine', frequency, time);
  const g = gainNode(ctx);
  percEnvelope(g.gain, time, peak, attack, tau);
  o.connect(g).connect(out);
  playOsc(o, time, attack + tau * 7);
}

/** Short filtered noise burst. */
function noiseHit(engine, out, time, { type = 'bandpass', freq = 2000, q = 1, peak = 0.3, attack = 0.001, tau = 0.02 }) {
  const ctx = engine.ctx;
  const src = noiseSource(engine, time, attack + tau * 7);
  const f = filterNode(ctx, type, freq, q);
  const g = gainNode(ctx);
  percEnvelope(g.gain, time, peak, attack, tau);
  src.connect(f).connect(g).connect(out);
  return f;
}

// ---------------------------------------------------------------------------
// Drums

function kick(engine, out, t, ev) {
  const ctx = engine.ctx;
  const k = ev.kit;
  const v = ev.vel * k.level;
  const o = oscillator(ctx, 'sine', k.pitchStart, t);
  o.frequency.exponentialRampToValueAtTime(k.pitchEnd, t + k.sweep);
  const g = gainNode(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.003);
  g.gain.setTargetAtTime(0, t + 0.012, k.decay / 4);
  o.connect(g).connect(out);
  playOsc(o, t, k.decay * 1.8);
  noiseHit(engine, out, t, { type: 'highpass', freq: 2500, peak: v * 0.25 * k.click, tau: 0.004 });
  engine.duck(t, ev.vel);
}

function snare(engine, out, t, ev) {
  const ctx = engine.ctx;
  const v = ev.vel;
  if (ev.kind === 'clap') {
    const src = noiseSource(engine, t, 0.5);
    const bp = filterNode(ctx, 'bandpass', 1250, 1.2);
    const hp = filterNode(ctx, 'highpass', 600);
    const g = gainNode(ctx);
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.011;
      g.gain.setValueAtTime(v * 0.8, tt);
      g.gain.setTargetAtTime(v * 0.08, tt + 0.001, 0.003);
    }
    g.gain.setValueAtTime(v * 0.75, t + 0.033);
    g.gain.setTargetAtTime(0, t + 0.034, 0.055);
    src.connect(bp).connect(hp).connect(g).connect(out);
    return;
  }
  // Soft, slightly brushed acoustic snare.
  noiseHit(engine, out, t, { type: 'bandpass', freq: 2100, q: 0.6, peak: v * 0.6, tau: 0.055 });
  const body = oscillator(ctx, 'triangle', 200, t);
  body.frequency.exponentialRampToValueAtTime(165, t + 0.05);
  const g = gainNode(ctx);
  percEnvelope(g.gain, t, v * 0.5, 0.001, 0.035);
  body.connect(g).connect(out);
  playOsc(body, t, 0.3);
}

function hat(engine, out, t, ev) {
  const f = noiseHit(engine, out, t, { type: 'highpass', freq: 7200, peak: ev.vel * 0.5, tau: (ev.decay || 0.04) / 2.5 });
  f.Q.value = 0.9;
}

function openhat(engine, out, t, ev) {
  noiseHit(engine, out, t, { type: 'highpass', freq: 6800, q: 0.8, peak: ev.vel * 0.35, attack: 0.004, tau: 0.11 });
}

// Inharmonic square partials give a metallic cymbal.
const RIDE_RATIOS = [1, 1.483, 1.932, 2.546, 2.63, 3.897];

function ride(engine, out, t, ev) {
  const ctx = engine.ctx;
  const bp = filterNode(ctx, 'bandpass', 7000, 0.8);
  const hp = filterNode(ctx, 'highpass', 4500);
  const g = gainNode(ctx);
  percEnvelope(g.gain, t, ev.vel * 0.09, 0.001, 0.3);
  bp.connect(hp).connect(g).connect(out);
  for (const r of RIDE_RATIOS) {
    const o = oscillator(ctx, 'square', 410 * r, t);
    o.connect(bp);
    playOsc(o, t, 2);
  }
  partial(ctx, out, t, 3150, ev.vel * 0.025, 0.25);
}

function shaker(engine, out, t, ev) {
  // The slow attack makes it sound like seeds moving in a shell.
  const ctx = engine.ctx;
  const src = noiseSource(engine, t, 0.25);
  const bp = filterNode(ctx, 'bandpass', 5600, 1.1);
  const hp = filterNode(ctx, 'highpass', 2500);
  const g = gainNode(ctx);
  percEnvelope(g.gain, t, ev.vel * 0.55, 0.012, 0.024);
  src.connect(bp).connect(hp).connect(g).connect(out);
}

function handDrum(engine, out, t, ev, frequencies, tau) {
  const ctx = engine.ctx;
  const f = frequencies[ev.pitch ?? 0];
  const o = oscillator(ctx, 'sine', f * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.025);
  const g = gainNode(ctx);
  percEnvelope(g.gain, t, ev.vel * 0.7, 0.002, tau);
  o.connect(g).connect(out);
  playOsc(o, t, tau * 8);
  noiseHit(engine, out, t, { type: 'bandpass', freq: 1800, q: 1.5, peak: ev.vel * 0.12, tau: 0.008 });
}

function conga(engine, out, t, ev) {
  handDrum(engine, out, t, ev, [205, 290], 0.1);
}

function bongo(engine, out, t, ev) {
  handDrum(engine, out, t, ev, [400, 540], 0.055);
}

function wood(engine, out, t, ev) {
  const ctx = engine.ctx;
  partial(ctx, out, t, 1080, ev.vel * 0.45, 0.02, 0.001);
  partial(ctx, out, t, 1720, ev.vel * 0.15, 0.012, 0.001);
  noiseHit(engine, out, t, { type: 'bandpass', freq: 3000, q: 2, peak: ev.vel * 0.08, tau: 0.004 });
}

function tick(engine, out, t, ev) {
  const ctx = engine.ctx;
  partial(ctx, out, t, 2650, ev.vel * 0.18, 0.05, 0.001);
  partial(ctx, out, t, 4110, ev.vel * 0.1, 0.03, 0.001);
}

// ---------------------------------------------------------------------------
// Melodic percussion and lead timbres

function kalimba(engine, out, t, freq, v) {
  const ctx = engine.ctx;
  const tau = 0.25 + 60 / freq;
  const carrier = oscillator(ctx, 'sine', freq, t);
  // Short FM burst for the metallic "pling" of the tine.
  const mod = oscillator(ctx, 'sine', freq * 3, t);
  const modGain = gainNode(ctx);
  percEnvelope(modGain.gain, t, freq * 1.1 * v, 0.001, 0.025);
  mod.connect(modGain).connect(carrier.frequency);
  const g = gainNode(ctx);
  percEnvelope(g.gain, t, v * 0.32, 0.002, tau);
  carrier.connect(g).connect(out);
  playOsc(carrier, t, tau * 7);
  playOsc(mod, t, 0.3);
  partial(ctx, out, t, freq * 5.93, v * 0.06, 0.035);
  noiseHit(engine, out, t, { type: 'highpass', freq: 3500, peak: v * 0.03, tau: 0.003 });
}

function bell(engine, out, t, freq, v) {
  const ctx = engine.ctx;
  const ratios = [1, 2.76, 5.4, 8.93];
  const amps = [1, 0.35, 0.16, 0.07];
  const taus = [0.8, 0.3, 0.12, 0.06];
  for (let i = 0; i < ratios.length; i++) partial(ctx, out, t, freq * ratios[i], v * 0.14 * amps[i], taus[i], 0.001);
}

function marimba(engine, out, t, freq, v) {
  const ctx = engine.ctx;
  partial(ctx, out, t, freq, v * 0.42, 0.22, 0.003);
  partial(ctx, out, t, freq * 3.93, v * 0.1, 0.05, 0.002);
  partial(ctx, out, t, freq * 9.2, v * 0.03, 0.02, 0.001);
}

function vibes(engine, out, t, freq, v, duration) {
  const ctx = engine.ctx;
  // Motor tremolo of the vibraphone.
  const trem = gainNode(ctx, 0.8);
  const lfo = oscillator(ctx, 'sine', 5.2, t);
  const depth = gainNode(ctx, 0.25);
  lfo.connect(depth).connect(trem.gain);
  trem.connect(out);
  const ring = Math.max(duration + 0.4, 1.2);
  const o = oscillator(ctx, 'sine', freq, t);
  const g = gainNode(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * 0.3, t + 0.002);
  g.gain.setTargetAtTime(0, t + 0.002, 0.9);
  g.gain.setTargetAtTime(0, t + ring, 0.12);
  o.connect(g).connect(trem);
  playOsc(o, t, ring + 1);
  playOsc(lfo, t, ring + 1);
  partial(ctx, trem, t, freq * 4, v * 0.07, 0.2);
  partial(ctx, trem, t, freq * 10, v * 0.015, 0.04);
}

function flute(engine, out, t, freq, v, duration) {
  const ctx = engine.ctx;
  const end = t + Math.max(duration, 0.12);
  const o = oscillator(ctx, 'triangle', freq * 0.985, t);
  o.frequency.setTargetAtTime(freq, t, 0.03);
  // Delayed vibrato, as a flute player would add it.
  const vib = oscillator(ctx, 'sine', 5.1, t);
  const vibDepth = gainNode(ctx);
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(freq * 0.007, t + 0.45);
  vib.connect(vibDepth).connect(o.frequency);
  const lp = filterNode(ctx, 'lowpass', 1400 + freq);
  const g = gainNode(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * 0.26, t + 0.07);
  g.gain.setTargetAtTime(v * 0.21, t + 0.07, 0.3);
  g.gain.setTargetAtTime(0, end, 0.08);
  o.connect(lp).connect(g).connect(out);
  const h = oscillator(ctx, 'sine', freq * 2, t);
  const hg = gainNode(ctx, 0.12);
  h.connect(hg).connect(g);
  // Breath noise.
  const breath = noiseSource(engine, t, end - t + 0.6);
  const bf = filterNode(ctx, 'bandpass', freq * 2, 2);
  const bg = gainNode(ctx);
  bg.gain.setValueAtTime(0, t);
  bg.gain.linearRampToValueAtTime(v * 0.05, t + 0.04);
  bg.gain.setTargetAtTime(v * 0.015, t + 0.08, 0.15);
  bg.gain.setTargetAtTime(0, end, 0.06);
  breath.connect(bf).connect(bg).connect(out);
  for (const x of [o, vib, h]) playOsc(x, t, end - t + 0.6);
}

const MALLETS = { kalimba, bell, marimba, vibes, flute };

function gear(engine, out, t, ev, stepDuration) {
  const fn = MALLETS[ev.timbre] || kalimba;
  fn(engine, out, t, midiToFreq(ev.note), ev.vel, ev.dur * stepDuration);
}

function lead(engine, out, t, ev, stepDuration) {
  const fn = MALLETS[ev.timbre] || flute;
  fn(engine, out, t, midiToFreq(ev.note), ev.vel, ev.dur * stepDuration);
}

// ---------------------------------------------------------------------------
// Bass

function bass(engine, out, t, ev, stepDuration) {
  const ctx = engine.ctx;
  const f = midiToFreq(ev.note);
  const v = ev.vel;
  const end = t + Math.max(ev.dur * stepDuration * 0.95, 0.08);
  const g = gainNode(ctx);
  g.connect(out);

  if (ev.timbre === 'upright') {
    const lp = filterNode(ctx, 'lowpass', 1100, 1);
    lp.frequency.setTargetAtTime(380, t, 0.09);
    const a = oscillator(ctx, 'triangle', f, t);
    const b = oscillator(ctx, 'sine', f, t);
    a.connect(lp);
    b.connect(lp);
    lp.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.3, t + 0.005);
    g.gain.setTargetAtTime(v * 0.12, t + 0.005, 0.2);
    g.gain.setTargetAtTime(0, end, 0.04);
    playOsc(a, t, end - t + 0.4);
    playOsc(b, t, end - t + 0.4);
    noiseHit(engine, out, t, { type: 'lowpass', freq: 260, peak: v * 0.25, tau: 0.02 });
    return;
  }

  const sub = oscillator(ctx, 'sine', f * 1.015, t);
  sub.frequency.setTargetAtTime(f, t, 0.02);
  const subGain = gainNode(ctx, ev.timbre === 'synth' ? 0.42 : 0.62);
  sub.connect(subGain).connect(g);

  const saw = oscillator(ctx, 'sawtooth', f, t);
  const lp = filterNode(ctx, 'lowpass', 0, ev.timbre === 'synth' ? 3 : 0.8);
  const open = ev.timbre === 'synth' ? 260 + 900 * v : 220 + 260 * v;
  lp.frequency.setValueAtTime(open, t);
  lp.frequency.setTargetAtTime(open * 0.45, t, 0.14);
  const sawGain = gainNode(ctx, ev.timbre === 'synth' ? 0.25 : 0.18);
  saw.connect(lp).connect(sawGain).connect(g);

  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * 0.75, t + 0.008);
  g.gain.setTargetAtTime(v * 0.6, t + 0.008, 0.25);
  g.gain.setTargetAtTime(0, end, 0.05);
  playOsc(sub, t, end - t + 0.4);
  playOsc(saw, t, end - t + 0.4);
}

// ---------------------------------------------------------------------------
// Keys and pad

function rhodesNote(engine, out, t, f, v, end) {
  const ctx = engine.ctx;
  const carrier = oscillator(ctx, 'sine', f, t);
  carrier.detune.value = (Math.random() - 0.5) * 6;
  const mod = oscillator(ctx, 'sine', f, t);
  const index = gainNode(ctx);
  index.gain.setValueAtTime(f * (0.5 + 1.5 * v), t);
  index.gain.setTargetAtTime(f * 0.08, t, 0.35);
  mod.connect(index).connect(carrier.frequency);
  const g = gainNode(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.003);
  g.gain.setTargetAtTime(0, t + 0.003, 1.5);
  g.gain.setTargetAtTime(0, end, 0.14);
  carrier.connect(g).connect(out);
  playOsc(carrier, t, end - t + 1);
  playOsc(mod, t, end - t + 1);
  // Bell-like tine attack.
  partial(ctx, out, t, f * 3.01, v * 0.12, 0.06);
}

function keys(engine, out, t, ev, stepDuration) {
  const end = t + Math.max(ev.dur * stepDuration, 0.1);
  const v = (ev.vel * 0.45) / Math.sqrt(ev.notes.length);
  ev.notes.forEach((n, i) => rhodesNote(engine, out, t + i * 0.004, midiToFreq(n), v, end));
}

function pad(engine, out, t, ev, stepDuration) {
  const ctx = engine.ctx;
  const end = t + ev.dur * stepDuration;
  const attack = Math.min(2.2, (end - t) * 0.4);
  const amp = (ev.vel * 0.09) / Math.sqrt(ev.notes.length);
  for (const n of ev.notes) {
    const f = midiToFreq(n);
    for (const detune of [-8, 8]) {
      const o = oscillator(ctx, 'sawtooth', f, t);
      o.detune.value = detune + (Math.random() - 0.5) * 4;
      const g = gainNode(ctx);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp, t + attack);
      g.gain.setTargetAtTime(0, end, 1.0);
      o.connect(g).connect(out);
      playOsc(o, t, end - t + 6);
    }
  }
}

// ---------------------------------------------------------------------------
// Texture and effects

function chirp(engine, out, t, ev) {
  const ctx = engine.ctx;
  const syllables = 2 + Math.floor(Math.random() * 4);
  const base = 3600 + Math.random() * 1600;
  let time = t;
  for (let i = 0; i < syllables; i++) {
    const length = 0.04 + Math.random() * 0.05;
    const o = oscillator(ctx, 'sine', base * (1 + Math.random() * 0.1), time);
    o.frequency.exponentialRampToValueAtTime(base * 0.62, time + length);
    const g = gainNode(ctx);
    percEnvelope(g.gain, time, ev.vel * 0.045, 0.006, length / 3);
    o.connect(g).connect(out);
    playOsc(o, time, length + 0.2);
    time += length + 0.04 + Math.random() * 0.08;
  }
}

function swell(engine, out, t, ev, stepDuration) {
  const ctx = engine.ctx;
  const duration = ev.dur * stepDuration;
  const src = noiseSource(engine, t, duration + 0.5);
  const bp = filterNode(ctx, 'bandpass', 300, 1.2);
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(5000, t + duration);
  const g = gainNode(ctx);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(ev.vel * 0.16, t + duration);
  g.gain.setTargetAtTime(0, t + duration, 0.06);
  src.connect(bp).connect(g).connect(out);
}

export const VOICES = {
  kick, snare, hat, openhat, ride, shaker, conga, bongo, wood, tick,
  gear, lead, bass, keys, pad, chirp, swell,
};
