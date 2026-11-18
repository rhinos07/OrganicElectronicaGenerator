// The sequencer connects the composer (what to play) with the audio engine
// (how it sounds). It schedules events a short time ahead of the audio clock.

import { Composer, STEPS_PER_BAR } from './composer.js';
import { AudioEngine } from './engine.js';

export class Sequencer {
  constructor(engine, composer, { bpm = 120, onInfo = null } = {}) {
    this.engine = engine;
    this.composer = composer;
    this.bpm = bpm;
    this.onInfo = onInfo;
    this.nextTime = 0;
    engine.setTempo(bpm);
  }

  get stepDuration() {
    return 60 / this.bpm / 4;
  }

  setTempo(bpm) {
    this.bpm = bpm;
    this.engine.setTempo(bpm);
  }

  start(time) {
    this.nextTime = time;
  }

  /** Schedules all steps that start before endTime. */
  scheduleUntil(endTime) {
    const ctx = this.engine.ctx;
    while (this.nextTime < endTime) {
      const stepDuration = this.stepDuration;
      const { events, info } = this.composer.nextStep();
      if (info) {
        this.engine.applyStyle(info.style, this.nextTime);
        if (this.onInfo) this.onInfo(info, this.nextTime);
      }
      for (const ev of events) {
        const time = Math.max(this.nextTime + ev.offset * stepDuration, ctx.currentTime);
        this.engine.play(ev, time, stepDuration);
      }
      this.nextTime += stepDuration;
    }
  }
}

/**
 * Renders music offline to an AudioBuffer. The graph is scheduled in chunks
 * (with suspend/resume), so memory use stays low for long renders.
 */
export async function renderOffline(settings, seconds, onProgress) {
  const sampleRate = 44100;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * seconds), sampleRate);
  const engine = new AudioEngine(ctx);
  engine.master.gain.value = settings.volume ?? 0.8;
  for (const [group, muted] of Object.entries(settings.mutes || {})) {
    if (muted) engine.channels[group].mute.gain.value = 0;
  }
  const composer = new Composer(settings);
  const sequencer = new Sequencer(engine, composer, { bpm: settings.bpm });
  sequencer.start(0.05);

  // Fade out at the end.
  const fade = Math.min(4, seconds / 4);
  engine.master.gain.setValueAtTime(engine.master.gain.value, seconds - fade);
  engine.master.gain.linearRampToValueAtTime(0, seconds - 0.05);

  const chunk = 2;
  sequencer.scheduleUntil(chunk * 2);
  for (let t = chunk; t < seconds; t += chunk) {
    ctx.suspend(t).then(() => {
      sequencer.scheduleUntil(Math.min(t + chunk * 2, seconds));
      if (onProgress) onProgress(t / seconds);
      ctx.resume();
    });
  }
  return ctx.startRendering();
}

/** Encodes an AudioBuffer as a 16-bit PCM WAV file. */
export function encodeWav(buffer) {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const bytes = 44 + length * channels * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const writeString = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, bytes - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * channels * 2, true);

  const data = [];
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}

export { STEPS_PER_BAR };
