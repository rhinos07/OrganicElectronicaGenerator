// The composer creates the music as a stream of note events, one 16th step at
// a time. It has no dependency on the Web Audio API, so it can be tested in
// Node.js and used for real-time playback and offline rendering alike.
//
// Musical principles (from the style brief):
// - Interlocking patterns ("gears"): several short melodic cycles of
//   different lengths (for example 16, 12 and 10 steps) run at the same time.
//   They shift against each other slowly, like gears in a clockwork.
// - Stable harmony: few chords with long durations. The gears use the
//   pentatonic scale, so they fit every chord of the progression.
// - Layering: the form adds and removes layers slowly instead of using drops.
// - A steady pulse with syncopated, polyrhythmic percussion around it.

import { createRng } from './random.js';
import { STYLES, ARRANGEMENT, layerLevel } from './styles.js';
import {
  SCALES,
  chordName,
  chordPitchClasses,
  voiceChord,
  bassNote,
  chordColorIntervals,
  scaleNote,
  foldIntoRange,
  snapToPitchClasses,
  pitchClass,
  NOTE_NAMES,
} from './theory.js';

export const STEPS_PER_BAR = 16;

// Which arrangement layer and which mixer channel a drum sound belongs to.
const DRUM_LAYER = {
  kick: 'kick', snare: 'snare', ghost: 'snare', hat: 'hats', openhat: 'hats', ride: 'hats',
  shaker: 'perc', conga: 'perc', bongo: 'perc', wood: 'perc', tick: 'perc',
};
const DRUM_CHANNEL = {
  kick: 'drums', snare: 'drums', ghost: 'drums', hat: 'drums', openhat: 'drums', ride: 'drums',
  shaker: 'perc', conga: 'perc', bongo: 'perc', wood: 'perc', tick: 'perc',
};
const DRUM_PAN = {
  kick: 0, snare: 0, ghost: 0.05, hat: 0.2, openhat: 0.25, ride: -0.2,
  shaker: 0.35, conga: -0.4, bongo: 0.45, wood: -0.3, tick: 0.3,
};
const DRUM_GAIN = {
  kick: 1, snare: 0.8, ghost: 0.22, hat: 0.45, openhat: 0.4, ride: 0.45,
  shaker: 0.45, conga: 0.65, bongo: 0.55, wood: 0.5, tick: 0.35,
};
const GEAR_PANS = [-0.3, 0.4, -0.5, 0.2];
// Register of each timbre, as an octave offset from the gear tonic (C4..B4).
const TIMBRE_OCTAVE = { kalimba: 0, bell: 1, marimba: -1, vibes: 0, flute: 0 };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Composer {
  constructor({ seed = 1, style = 'organic', key = 9, energy = 0.6, startSection = 0 } = {}) {
    // startSection: index of the arrangement section to begin with (for tests and previews).
    this.initialSection = startSection;
    this.seed = seed >>> 0;
    this.rng = createRng(this.seed);
    this.styleId = STYLES[style] ? style : 'organic';
    this.key = key;
    this.energy = clamp(energy, 0, 1);
    this.pending = {};
    this.step = 0;
    this.position = null;
    this.songCount = 0;
    this.voicingMean = 62;
  }

  get style() {
    return STYLES[this.styleId];
  }

  get section() {
    return ARRANGEMENT[this.position.sectionIndex];
  }

  // Changes take effect at the start of the next bar, so the music stays in time.
  setStyle(id) {
    if (STYLES[id]) this.pending.style = id;
  }

  setKey(pc) {
    this.pending.key = ((pc % 12) + 12) % 12;
  }

  setEnergy(value) {
    this.energy = clamp(value, 0, 1);
  }

  newVariation(seed) {
    this.pending.seed = seed >>> 0;
  }

  /** Returns the events of the next 16th step and advances the clock. */
  nextStep() {
    const stepInBar = this.step % STEPS_PER_BAR;
    let info = null;
    const events = [];
    if (stepInBar === 0) {
      this.beginBar(events);
      info = this.info();
    }
    this.drumEvents(stepInBar, events);
    this.gearEvents(stepInBar, events);
    this.bassEvents(stepInBar, events);
    this.keysEvents(stepInBar, events);
    this.padEvents(stepInBar, events);
    this.leadEvents(stepInBar, events);

    const swing = this.swingOffset(stepInBar);
    for (const ev of events) {
      const tight = ev.type === 'kick' || ev.channel === 'bass' || ev.channel === 'gears';
      const human = tight ? this.rng.range(-0.008, 0.008) : this.rng.range(-0.03, 0.03);
      ev.offset = (ev.offset || 0) + (ev.noSwing ? 0 : swing) + human;
    }
    this.step++;
    return { events, info, stepInBar };
  }

  info() {
    const p = this.position;
    return {
      style: this.styleId,
      styleName: this.style.name,
      section: this.section.name,
      sectionIndex: p.sectionIndex,
      bar: p.barInSection + 1,
      bars: this.section.bars,
      chord: chordName(this.key, this.chord),
      key: NOTE_NAMES[this.key],
      song: this.songCount,
      gears: this.activeGearCount(),
    };
  }

  // ---------------------------------------------------------------------------
  // Song structure

  beginBar(events) {
    let rebuild = false;
    let reset = false;
    let sectionStart = false;
    let keyChanged = false;

    if (this.pending.seed !== undefined) {
      this.seed = this.pending.seed;
      this.rng = createRng(this.seed);
      rebuild = true;
    }
    if (this.pending.style && this.pending.style !== this.styleId) {
      this.styleId = this.pending.style;
      rebuild = true;
    }
    if (this.pending.key !== undefined && this.pending.key !== this.key) {
      this.key = this.pending.key;
      keyChanged = true;
    }
    this.pending = {};

    if (!this.position) {
      reset = true;
    } else {
      const p = this.position;
      p.barInSection++;
      p.songBar++;
      if (p.barInSection >= this.section.bars) {
        p.sectionIndex++;
        p.barInSection = 0;
        sectionStart = true;
        if (p.sectionIndex >= ARRANGEMENT.length) reset = true;
      }
    }
    if (reset) {
      this.position = { sectionIndex: this.initialSection, barInSection: 0, songBar: 0 };
      this.initialSection = 0;
      this.songCount++;
      rebuild = true;
    }
    if (rebuild) this.buildMaterial();
    if (rebuild || sectionStart) this.startSection();
    else if (this.position.barInSection % 8 === 0) this.evolve();

    this.updateHarmony(rebuild || keyChanged);
    this.rollBarVariation();
    this.barEvents(events);
  }

  /** Creates the material of a new song: harmony, gears, lead timbre. */
  buildMaterial() {
    const style = this.style;
    this.progression = this.rng.pick(style.progressions);
    this.gears = this.makeGears();
    this.leadTimbre = this.rng.pick(style.lead.timbres);
  }

  /** Chooses the patterns of a section. They repeat during the section. */
  startSection() {
    const style = this.style;
    this.drumThresholds = {};
    for (const [name, table] of Object.entries(style.drums)) {
      this.drumThresholds[name] = table.map(() => ({ r: this.rng.next(), v: this.rng.range(0.85, 1) }));
    }
    this.bassTemplate = style.bass.templates ? this.rng.pick(style.bass.templates) : null;
    this.compTemplate = this.rng.pick(style.comp);
    this.phrase = this.makePhrase();
  }

  /** Slow evolution inside a section: one gear changes a little. */
  evolve() {
    this.mutateGear();
    this.phrase = this.makePhrase();
    // Re-roll some of the percussion decisions.
    for (const name of ['hat', 'shaker', 'conga', 'bongo']) {
      const list = this.drumThresholds[name];
      if (!list) continue;
      for (const item of list) if (this.rng.chance(0.25)) item.r = this.rng.next();
    }
  }

  updateHarmony(force) {
    const p = this.position;
    const bpc = this.style.barsPerChord;
    const prog = this.progression;
    const index = Math.floor(p.songBar / bpc) % prog.length;
    const nextIndex = Math.floor((p.songBar + 1) / bpc) % prog.length;
    const changed = force || this.chord !== prog[index];
    this.chord = prog[index];
    this.nextChord = prog[nextIndex];
    this.barOfChord = p.songBar % bpc;
    if (changed) {
      this.voicing = voiceChord(this.key, this.chord, this.voicingMean);
      this.voicingMean = this.voicing.reduce((a, b) => a + b, 0) / this.voicing.length;
      this.chordPcs = chordPitchClasses(this.key, this.chord);
    }
  }

  /** Per-bar variation: ghost notes and the walking bass line. */
  rollBarVariation() {
    const ghost = this.drumThresholds.ghost;
    if (ghost) for (const item of ghost) item.r = this.rng.next();
    if (this.style.bass.mode === 'walking') this.walkingLine = this.makeWalkingLine();
  }

  /** Events that happen once per bar: texture level, birds, swells. */
  barEvents(events) {
    const p = this.position;
    const section = this.section;
    const texture = layerLevel(section, 'texture', p.barInSection) * this.style.mix.texture;
    events.push({ type: 'texture', channel: 'texture', level: texture, noSwing: true });

    if (texture > 0.35 && this.rng.chance(0.14)) {
      events.push({
        type: 'chirp', channel: 'texture', vel: this.rng.range(0.3, 0.7),
        pan: this.rng.range(-0.8, 0.8), offset: this.rng.range(0, 12), noSwing: true,
      });
    }

    // A soft noise swell before the groove comes in. No big build-up.
    const next = ARRANGEMENT[p.sectionIndex + 1];
    if (next && p.barInSection === section.bars - 1) {
      const kickNow = layerLevel(section, 'kick', p.barInSection);
      const kickNext = layerLevel(next, 'kick', 0);
      if (kickNext >= 0.9 && kickNow < 0.9) {
        events.push({ type: 'swell', channel: 'fx', dur: STEPS_PER_BAR, vel: 0.6, noSwing: true });
      }
    }
  }

  level(layer) {
    return layerLevel(this.section, layer, this.position.barInSection);
  }

  swingOffset(stepInBar) {
    const { unit, amount } = this.style.swing;
    if (unit === 8) {
      const pos = stepInBar % 4;
      if (pos === 2) return amount;
      if (pos === 1 || pos === 3) return amount * 0.5;
      return 0;
    }
    return stepInBar % 2 === 1 ? amount : 0;
  }

  // ---------------------------------------------------------------------------
  // Drums and percussion

  drumEvents(stepInBar, events) {
    const style = this.style;
    const p = this.position;
    const isFillBar = p.barInSection === this.section.bars - 1;
    const energyFactor = 0.55 + 0.9 * this.energy;
    const accent = stepInBar % 4 === 0 ? 1 : stepInBar % 2 === 0 ? 0.8 : 0.62;

    for (const [name, table] of Object.entries(style.drums)) {
      const prob = table[this.step % table.length];
      if (!prob) continue;
      const layer = DRUM_LAYER[name];
      const level = this.level(layer);
      if (level <= 0.02) continue;

      // Sparse versions of kick and snare at low levels (half-time feel).
      if (name === 'kick' && level < 0.6 && stepInBar % 8 !== 0) continue;
      if (name === 'snare' && level < 0.5 && stepInBar !== 12) continue;

      const t = this.drumThresholds[name][this.step % table.length];
      if (prob < 1) {
        const eff = clamp(prob * energyFactor, 0, 0.97) * (0.3 + 0.7 * level);
        if (t.r >= eff) continue;
      }
      const type = name === 'ghost' ? 'snare' : name;
      const ev = {
        type,
        channel: DRUM_CHANNEL[name],
        vel: DRUM_GAIN[name] * accent * t.v * (0.55 + 0.45 * level),
        pan: DRUM_PAN[name],
      };
      if (type === 'kick') ev.kit = style.kit.kick;
      if (type === 'snare') ev.kind = style.kit.snare;
      if (type === 'hat') ev.decay = style.kit.hatDecay;
      if (type === 'conga' || type === 'bongo') ev.pitch = (this.step % table.length) % 3 === 0 ? 0 : 1;
      events.push(ev);
    }

    // Short hand-drum fill at the end of a section.
    if (isFillBar && stepInBar >= 12 && this.level('perc') > 0.3 && this.rng.chance(0.4 + 0.4 * this.energy)) {
      events.push({
        type: 'conga', channel: 'perc', vel: 0.45 + 0.08 * (stepInBar - 12),
        pan: this.rng.range(-0.5, 0.5), pitch: stepInBar % 2,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Gears: interlocking melodic cycles

  makeGears() {
    const cfg = this.style.gears;
    const rest = this.rng.shuffle(cfg.cycles.slice(1));
    const cycles = [cfg.cycles[0], ...rest];
    const occupied = new Array(16).fill(0);
    const gears = [];

    for (let i = 0; i < 4; i++) {
      const timbre = cfg.timbres[i % cfg.timbres.length];
      const cycle = cycles[i % cycles.length];
      const grid = i === 0 ? cfg.grid : Math.max(cfg.grid, this.rng.pick([1, 2, 2]));
      const slots = [];
      for (let s = 0; s < cycle; s += grid) slots.push(s);

      // The first gear is the densest. Later gears prefer free positions, so
      // the patterns interlock instead of doubling each other.
      const density = i === 0 ? this.rng.range(0.45, 0.6) : this.rng.range(0.28, 0.42);
      const count = clamp(Math.round(slots.length * density), 2, slots.length);
      const chosen = [];
      const pool = slots.slice();
      while (chosen.length < count && pool.length) {
        const weights = pool.map((s) => (occupied[s % 16] ? 0.3 : 1) * (s === 0 && i === 0 ? 4 : 1));
        const s = this.rng.weighted(pool, weights);
        chosen.push(s);
        pool.splice(pool.indexOf(s), 1);
      }
      chosen.sort((a, b) => a - b);
      for (const s of chosen) occupied[s % 16]++;

      // A short ostinato: a small set of pentatonic degrees in a repeating contour.
      const low = this.rng.int(0, 2);
      const set = [low, low + this.rng.int(1, 2), low + this.rng.int(2, 4), low + this.rng.int(3, 5)];
      const contourLength = this.rng.pick([2, 3, 4]);
      const contour = Array.from({ length: contourLength }, () => this.rng.pick(set));
      const onsets = chosen.map((s, n) => ({
        s,
        deg: contour[n % contourLength],
        vel: n === 0 ? 1 : this.rng.range(0.55, 0.85),
      }));
      gears.push({ timbre, cycle, onsets, pan: GEAR_PANS[i], octave: TIMBRE_OCTAVE[timbre] ?? 0 });
    }
    return gears;
  }

  mutateGear() {
    if (!this.gears) return;
    const gear = this.rng.pick(this.gears);
    const onset = this.rng.pick(gear.onsets);
    if (this.rng.chance(0.6)) {
      onset.deg = clamp(onset.deg + this.rng.pick([-1, 1, 2]), 0, 7);
    } else {
      const target = (onset.s + this.rng.pick([-1, 1, 2])) % gear.cycle;
      const free = target >= 0 && !gear.onsets.some((o) => o.s === target);
      if (free) {
        onset.s = target;
        gear.onsets.sort((a, b) => a.s - b.s);
      }
    }
  }

  activeGearCount() {
    return Math.ceil(this.level('gears') - 1e-6);
  }

  gearEvents(stepInBar, events) {
    const level = this.level('gears');
    if (level <= 0) return;
    const count = Math.min(this.gears.length, Math.ceil(level - 1e-6));
    const fraction = level - Math.floor(level);
    const tonic = foldIntoRange(this.key, 60);
    const scale = SCALES[this.style.gearScale];

    for (let i = 0; i < count; i++) {
      const gear = this.gears[i];
      const pos = this.step % gear.cycle;
      // The newest gear fades in while the level ramps up.
      const fade = i === count - 1 && fraction > 0 ? 0.25 + 0.75 * fraction : 1;
      for (const onset of gear.onsets) {
        if (onset.s !== pos) continue;
        let note = scaleNote(tonic, scale, onset.deg) + gear.octave * 12;
        note = this.avoidClash(note);
        events.push({
          type: 'gear', channel: 'gears', timbre: gear.timbre, note,
          vel: onset.vel * fade * 0.8, pan: gear.pan, dur: 2,
        });
      }
    }
  }

  /** A note a semitone above a chord tone sounds harsh: move it onto the chord tone. */
  avoidClash(note) {
    const pcs = this.chordPcs;
    if (!pcs.includes(pitchClass(note)) && pcs.includes(pitchClass(note - 1))) return note - 1;
    return note;
  }

  // ---------------------------------------------------------------------------
  // Bass

  bassEvents(stepInBar, events) {
    const level = this.level('bass');
    if (level <= 0.02) return;
    const style = this.style;
    const vel = 0.85 * (0.6 + 0.4 * level);

    if (style.bass.mode === 'walking') {
      const line = this.walkingLine;
      const halfTime = level < 0.6;
      if (stepInBar % 4 === 0) {
        const beat = stepInBar / 4;
        if (halfTime && beat % 2 === 1) return;
        events.push({
          type: 'bass', channel: 'bass', timbre: style.bass.timbre, note: line[beat],
          vel: vel * (beat === 0 ? 1 : 0.85), dur: halfTime ? 7.5 : 3.6,
        });
      } else if ((stepInBar === 6 || stepInBar === 14) && !halfTime && this.rng.chance(0.18)) {
        // Dead note between the beats, as a jazz bassist would play it.
        events.push({
          type: 'bass', channel: 'bass', timbre: style.bass.timbre,
          note: line[Math.floor(stepInBar / 4)], vel: vel * 0.35, dur: 0.6,
        });
      }
      return;
    }

    const template = this.bassTemplate;
    template.forEach((entry, index) => {
      if (entry.s !== stepInBar) return;
      if (level < 0.75 && index > 0 && entry.d !== 'root') return;
      events.push({
        type: 'bass', channel: 'bass', timbre: style.bass.timbre,
        note: bassNote(this.key, this.chord, this.bassInterval(entry.d)),
        vel: vel * (index === 0 ? 1 : 0.85), dur: entry.l,
      });
    });
  }

  bassInterval(degree) {
    const { third, seventh } = chordColorIntervals(this.chord);
    switch (degree) {
      case 'fifth': return 7;
      case 'octave': return 12;
      case 'seventh': return seventh - 12;
      case 'third': return third;
      default: return 0;
    }
  }

  makeWalkingLine() {
    const rng = this.rng;
    const root = bassNote(this.key, this.chord, 0, 31);
    const { third, seventh } = chordColorIntervals(this.chord);
    const nextRoot = bassNote(this.key, this.nextChord, 0, 31);
    const n2 = root + rng.pick([third, 7, 2, third]);
    const n3 = root + rng.pick([7, seventh, 12, third + 12]);
    const target = nextRoot + 12 * Math.round((n3 - nextRoot) / 12);
    const n4 = target + rng.pick([-1, 1, -1, 1, 7]);
    return [root, n2, n3, n4].map((n) => {
      let x = n;
      while (x > 52) x -= 12;
      while (x < 28) x += 12;
      return x;
    });
  }

  // ---------------------------------------------------------------------------
  // Keys (Rhodes) and pad

  keysEvents(stepInBar, events) {
    const level = this.level('keys');
    if (level <= 0.02) return;
    for (const entry of this.compTemplate) {
      if (entry.s !== stepInBar) continue;
      if (entry.bar !== undefined && entry.bar !== this.barOfChord) continue;
      if (level < 0.3 && entry.s !== 0) continue;
      events.push({
        type: 'keys', channel: 'keys', notes: this.voicing,
        vel: entry.v * (0.5 + 0.5 * level) * this.rng.range(0.9, 1.05), dur: entry.l,
      });
    }
  }

  padEvents(stepInBar, events) {
    if (stepInBar !== 0 || this.barOfChord !== 0) return;
    const level = this.level('pad');
    if (level <= 0.02) return;
    const { third, seventh } = chordColorIntervals(this.chord);
    const r = foldIntoRange(this.key + this.chord.root, 45);
    events.push({
      type: 'pad', channel: 'pad',
      notes: [r, r + 7, r + seventh, r + third + 12, r + 14],
      vel: level, dur: this.style.barsPerChord * STEPS_PER_BAR, noSwing: true,
    });
  }

  // ---------------------------------------------------------------------------
  // Lead motif: a phrase of 8 bars built from one short motif

  makeMotif(minNotes, maxNotes, startDegree) {
    const cfg = this.style.lead;
    const slots = [];
    for (let s = 0; s < 32; s += cfg.grid) slots.push(s);
    const count = this.rng.int(minNotes, maxNotes);
    const steps = this.rng.shuffle(slots).slice(0, count).sort((a, b) => a - b);
    let deg = startDegree ?? this.rng.pick([0, 2, 4, 7]);
    return steps.map((s, i) => {
      if (i > 0) deg = clamp(deg + this.rng.pick([-2, -1, -1, 1, 1, 2, 3, -3]), -3, 9);
      const next = steps[i + 1] ?? 32;
      return { s, deg, l: Math.min(next - s, cfg.maxLen), v: this.rng.range(0.65, 0.95) };
    });
  }

  makePhrase() {
    const cfg = this.style.lead;
    const [lo, hi] = cfg.density;
    const a = this.makeMotif(lo, hi);
    // A': same rhythm, the last note changes.
    const a2 = a.map((n, i) => (i === a.length - 1 ? { ...n, deg: clamp(n.deg + this.rng.pick([-2, -1, 1, 2]), -3, 9) } : n));
    // A transposed, or a rest (call and response).
    const shift = this.rng.pick([1, 2, -1]);
    const a3 = this.rng.chance(0.3) ? [] : a.map((n) => ({ ...n, deg: clamp(n.deg + shift, -3, 9) }));
    // B: an answer that comes to rest on the tonic.
    const b = this.makeMotif(Math.max(2, lo - 1), Math.max(2, hi - 2));
    if (b.length) {
      const last = b[b.length - 1];
      last.deg = 0;
      last.l = Math.min(32 - last.s, cfg.maxLen * 2);
    }

    const bars = Array.from({ length: 8 }, () => []);
    [a, a2, a3, b].forEach((motif, part) => {
      for (const n of motif) {
        const bar = part * 2 + Math.floor(n.s / 16);
        bars[bar].push({ ...n, s: n.s % 16 });
      }
    });
    return bars;
  }

  leadEvents(stepInBar, events) {
    const level = this.level('lead');
    if (level <= 0.02) return;
    const bar = this.position.barInSection % 8;
    const tonic = foldIntoRange(this.key, 62);
    const scale = SCALES[this.style.scale];
    for (const n of this.phrase[bar]) {
      if (n.s !== stepInBar) continue;
      let note = scaleNote(tonic, scale, n.deg);
      if (stepInBar % 8 === 0) note = snapToPitchClasses(note, this.chordPcs, 2);
      note = this.avoidClash(note);
      events.push({
        type: 'lead', channel: 'lead', timbre: this.leadTimbre, note,
        vel: n.v * (0.55 + 0.45 * level), dur: n.l,
      });
    }
  }
}
