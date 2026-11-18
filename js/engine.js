// Audio engine: mixer channels, effects and the master chain.
// It works with a real-time AudioContext and with an OfflineAudioContext.

import { VOICES } from './voices.js';
import { STYLES } from './styles.js';

// Mixer channels. "duck" is the amount of sidechain ducking from the kick.
const CHANNELS = {
  drums: { level: 0.68, reverb: 0.06, delay: 0, duck: 0 },
  perc: { level: 0.7, reverb: 0.22, delay: 0.08, duck: 0 },
  gears: { level: 0.19, reverb: 0.3, delay: 0.35, duck: 0.15 },
  bass: { level: 0.66, reverb: 0, delay: 0, duck: 0.45 },
  keys: { level: 0.85, reverb: 0.35, delay: 0.12, duck: 0.3, autopan: true },
  pad: { level: 0.55, reverb: 0.6, delay: 0, duck: 0.4, filter: true },
  lead: { level: 0.42, reverb: 0.4, delay: 0.3, duck: 0.15 },
  texture: { level: 1, reverb: 0.3, delay: 0, duck: 0 },
  fx: { level: 0.35, reverb: 0.7, delay: 0.2, duck: 0 },
};

export const MIXER_GROUPS = ['drums', 'perc', 'gears', 'bass', 'keys', 'pad', 'lead', 'texture'];

export class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    this.bpm = 120;
    this.styleId = null;
    this.noise = this.makeNoiseBuffer(2);
    this.buildMaster();
    this.buildEffects();
    this.channels = {};
    for (const [name, cfg] of Object.entries(CHANNELS)) this.channels[name] = this.buildChannel(name, cfg);
    this.buildTexture();
  }

  // ---------------------------------------------------------------------------
  // Graph

  buildMaster() {
    const ctx = this.ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.8;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 28;

    // Gentle tape-like saturation for warmth.
    const saturation = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(1.4 * x) / Math.tanh(1.4);
    }
    saturation.curve = curve;
    saturation.oversample = '2x';

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.knee.value = 10;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.015;
    glue.release.value = 0.25;

    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -2;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.82;

    this.bus.connect(highpass).connect(saturation).connect(glue).connect(limiter).connect(this.master);
    this.master.connect(this.analyser);
    this.master.connect(ctx.destination);
  }

  buildEffects() {
    const ctx = this.ctx;
    // Reverb with a generated impulse response (no files needed).
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.6);
    this.reverbReturn = ctx.createGain();
    this.reverbReturn.gain.value = 0.3;
    const reverbTone = ctx.createBiquadFilter();
    reverbTone.type = 'lowpass';
    reverbTone.frequency.value = 6000;
    this.reverb.connect(reverbTone).connect(this.reverbReturn).connect(this.bus);
    this.reverbSend = ctx.createGain();
    this.reverbSend.connect(this.reverb);

    // Ping-pong delay, synced to the tempo (dotted eighth).
    this.delaySend = ctx.createGain();
    this.delayL = ctx.createDelay(3);
    this.delayR = ctx.createDelay(3);
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.4;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = 'lowpass';
    delayTone.frequency.value = 3200;
    const delayHp = ctx.createBiquadFilter();
    delayHp.type = 'highpass';
    delayHp.frequency.value = 250;
    const merger = ctx.createChannelMerger(2);
    this.delayReturn = ctx.createGain();
    this.delayReturn.gain.value = 0.25;

    this.delaySend.connect(delayHp).connect(this.delayL);
    this.delayL.connect(this.delayR);
    this.delayR.connect(delayTone).connect(this.delayFeedback).connect(this.delayL);
    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);
    merger.connect(this.delayReturn).connect(this.bus);
    this.delayReturn.connect(this.reverbSend);
    this.setTempo(this.bpm);
  }

  buildChannel(name, cfg) {
    const ctx = this.ctx;
    const input = ctx.createGain();
    let node = input;

    if (cfg.filter) {
      // Slowly moving low-pass filter: the pad "breathes".
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      filter.Q.value = 0.7;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.045;
      const depth = ctx.createGain();
      depth.gain.value = 650;
      lfo.connect(depth).connect(filter.frequency);
      lfo.start();
      node.connect(filter);
      node = filter;
    }
    if (cfg.autopan) {
      // Stereo tremolo, typical for a Rhodes piano.
      const panner = ctx.createStereoPanner();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 2.6;
      const depth = ctx.createGain();
      depth.gain.value = 0.35;
      lfo.connect(depth).connect(panner.pan);
      lfo.start();
      node.connect(panner);
      node = panner;
    }

    const duck = ctx.createGain();
    const level = ctx.createGain();
    level.gain.value = cfg.level;
    const mute = ctx.createGain();
    node.connect(duck).connect(level).connect(mute).connect(this.bus);

    const reverb = ctx.createGain();
    reverb.gain.value = cfg.reverb;
    mute.connect(reverb).connect(this.reverbSend);
    const delay = ctx.createGain();
    delay.gain.value = cfg.delay;
    mute.connect(delay).connect(this.delaySend);

    return { name, input, duck, level, mute, reverb, delay, cfg };
  }

  /** Continuous background: vinyl crackle and a soft airy noise bed. */
  buildTexture() {
    const ctx = this.ctx;
    const channel = this.channels.texture;
    this.textureGain = ctx.createGain();
    this.textureGain.gain.value = 0;
    this.textureGain.connect(channel.input);

    const crackle = ctx.createBufferSource();
    crackle.buffer = this.makeCrackleBuffer(6);
    crackle.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.9;
    crackle.connect(crackleGain).connect(this.textureGain);

    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.value = 500;
    airFilter.Q.value = 0.6;
    const airLfo = ctx.createOscillator();
    airLfo.frequency.value = 0.07;
    const airDepth = ctx.createGain();
    airDepth.gain.value = 300;
    airLfo.connect(airDepth).connect(airFilter.frequency);
    const airGain = ctx.createGain();
    airGain.gain.value = 0.08;
    air.connect(airFilter).connect(airGain).connect(this.textureGain);

    const t = ctx.currentTime;
    crackle.start(t);
    air.start(t);
    airLfo.start(t);
    this.textureSources = [crackle, air, airLfo];
  }

  // ---------------------------------------------------------------------------
  // Buffers

  makeNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  makeImpulse(seconds, decay) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        // Darker tail: a one-pole low-pass that closes over time.
        const coeff = 0.15 + 0.8 * t;
        smooth = smooth * coeff + (Math.random() * 2 - 1) * (1 - coeff);
        const env = Math.pow(1 - t, decay);
        const predelay = i < ctx.sampleRate * 0.012 ? 0 : 1;
        data[i] = smooth * env * predelay * 1.6;
      }
    }
    return buffer;
  }

  makeCrackleBuffer(seconds) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const buffer = ctx.createBuffer(2, Math.floor(sr * seconds), sr);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      let hiss = 0;
      for (let i = 0; i < data.length; i++) {
        hiss = hiss * 0.7 + (Math.random() * 2 - 1) * 0.3;
        data[i] = hiss * 0.012;
      }
      const clicks = Math.floor(seconds * 9);
      for (let k = 0; k < clicks; k++) {
        const pos = Math.floor(Math.random() * (data.length - 40));
        const amp = Math.pow(Math.random(), 3) * 0.5 + 0.02;
        const sign = Math.random() < 0.5 ? -1 : 1;
        for (let j = 0; j < 24; j++) data[pos + j] += sign * amp * Math.exp(-j / 3) * (j % 2 ? -0.6 : 1);
      }
    }
    return buffer;
  }

  // ---------------------------------------------------------------------------
  // Control

  setTempo(bpm) {
    this.bpm = bpm;
    const beat = 60 / bpm;
    const t = this.ctx.currentTime;
    this.delayL.delayTime.setTargetAtTime(beat * 0.75, t, 0.05);
    this.delayR.delayTime.setTargetAtTime(beat * 0.75, t, 0.05);
  }

  applyStyle(styleId, time) {
    if (styleId === this.styleId) return;
    this.styleId = styleId;
    const mix = STYLES[styleId].mix;
    const t = Math.max(time, this.ctx.currentTime);
    this.reverbReturn.gain.setTargetAtTime(mix.reverb, t, 0.5);
    this.delayReturn.gain.setTargetAtTime(mix.delay, t, 0.5);
    this.delayFeedback.gain.setTargetAtTime(mix.delayFeedback, t, 0.5);
  }

  setVolume(volume) {
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
  }

  /** Fader of a mixer channel: 1 is the default level, 0 is silent. */
  setChannelLevel(group, value) {
    const channel = this.channels[group];
    if (channel) channel.level.gain.setTargetAtTime(channel.cfg.level * value, this.ctx.currentTime, 0.04);
  }

  setMuted(group, muted) {
    const channel = this.channels[group];
    if (channel) channel.mute.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.04);
  }

  /** Sidechain ducking: other channels make room for the kick. */
  duck(time, amount) {
    for (const channel of Object.values(this.channels)) {
      const depth = channel.cfg.duck * amount;
      if (!depth) continue;
      const g = channel.duck.gain;
      g.setTargetAtTime(1 - depth, time, 0.004);
      g.setTargetAtTime(1, time + 0.03, 0.09);
    }
  }

  setTextureLevel(level, time) {
    this.textureGain.gain.setTargetAtTime(level, time, 1.5);
  }

  /** Plays one composer event at the given time. */
  play(ev, time, stepDuration) {
    if (ev.type === 'texture') {
      this.setTextureLevel(ev.level, time);
      return;
    }
    const voice = VOICES[ev.type];
    if (!voice) return;
    const channel = this.channels[ev.channel] || this.channels.fx;
    let destination = channel.input;
    if (ev.pan) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = ev.pan;
      panner.connect(channel.input);
      destination = panner;
    }
    voice(this, destination, time, ev, stepDuration);
  }

  /** Fades out and releases the graph. */
  dispose() {
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0, t, 0.08);
    setTimeout(() => {
      for (const s of this.textureSources) {
        try { s.stop(); } catch { /* already stopped */ }
      }
      this.master.disconnect();
    }, 600);
  }
}
