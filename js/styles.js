// Style definitions. A style is pure data: tempo, harmony, rhythm
// probabilities, instrument choices and mix settings. The composer reads it.
//
// Drum tables contain hit probabilities per 16th step. A table does not have
// to be 16 steps long: a 12 or 6 step table runs against the 4/4 bar and
// creates a polyrhythm (for example 3 against 4).

const r16 = (pattern) => pattern; // Marker for readability: a 16-step table.

export const STYLES = {
  organic: {
    id: 'organic',
    name: 'Organic House',
    description: 'Warm, driving house groove with interlocking kalimba and bell patterns',
    bpm: 120,
    bpmMin: 108,
    bpmMax: 126,
    // Swing: delay of off-beat steps, in fractions of one 16th step.
    swing: { unit: 16, amount: 0.12 },
    scale: 'dorian',
    gearScale: 'minorPentatonic',
    // Stable harmony: few chords, long durations.
    barsPerChord: 4,
    progressions: [
      [{ root: 0, type: 'm9' }, { root: 5, type: 'm9' }],
      [{ root: 0, type: 'm11' }, { root: 8, type: 'maj9' }],
      [{ root: 0, type: 'm9' }, { root: 10, type: 'sus9' }],
      [{ root: 0, type: 'm9' }, { root: 3, type: 'maj9' }],
      [{ root: 0, type: 'm11' }, { root: 0, type: 'm11' }, { root: 5, type: 'm9' }, { root: 8, type: 'maj9' }],
    ],
    kit: {
      kick: { pitchStart: 140, pitchEnd: 46, sweep: 0.06, decay: 0.42, click: 0.35, level: 0.9 },
      snare: 'clap',
      hatDecay: 0.04,
    },
    drums: {
      kick: r16([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0.08]),
      snare: r16([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
      ghost: r16([0, 0, 0, 0, 0, 0, 0, 0.08, 0, 0, 0, 0, 0, 0, 0.1, 0]),
      hat: r16([0.35, 0.5, 0, 0.55, 0.35, 0.5, 0, 0.55, 0.35, 0.5, 0, 0.55, 0.35, 0.5, 0, 0.7]),
      openhat: r16([0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
      shaker: r16([0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8, 0.9, 0.8]),
      conga: r16([0, 0, 0.3, 0.5, 0, 0.35, 0, 0.4, 0, 0, 0.45, 0, 0.35, 0, 0.4, 0.2]),
      bongo: r16([0, 0.2, 0, 0, 0.3, 0, 0, 0.2, 0, 0.25, 0, 0.3, 0, 0, 0, 0.3]),
      // 3-against-4: a woodblock cycle of 6 steps (dotted eighths).
      wood: [0.85, 0, 0, 0.5, 0, 0],
      // A small metallic tick on a 12-step cycle.
      tick: [0, 0, 0.6, 0, 0, 0.3, 0, 0, 0.5, 0, 0.35, 0],
      ride: r16(new Array(16).fill(0)),
    },
    bass: {
      mode: 'pattern',
      timbre: 'round',
      templates: [
        [{ s: 0, l: 3, d: 'root' }, { s: 7, l: 2, d: 'root' }, { s: 10, l: 4, d: 'fifth' }],
        [{ s: 2, l: 2, d: 'root' }, { s: 6, l: 2, d: 'root' }, { s: 10, l: 3, d: 'octave' }, { s: 14, l: 1, d: 'root' }],
        [{ s: 0, l: 2, d: 'root' }, { s: 3, l: 2, d: 'root' }, { s: 11, l: 3, d: 'seventh' }],
        [{ s: 2, l: 4, d: 'root' }, { s: 9, l: 2, d: 'fifth' }, { s: 12, l: 3, d: 'root' }],
      ],
    },
    comp: [
      [{ s: 0, l: 28, v: 0.55, bar: 0 }],
      [{ s: 0, l: 6, v: 0.55 }, { s: 10, l: 4, v: 0.4 }],
      [{ s: 3, l: 3, v: 0.5 }, { s: 11, l: 3, v: 0.45 }],
    ],
    gears: {
      timbres: ['kalimba', 'bell', 'marimba', 'kalimba'],
      cycles: [16, 12, 10, 8, 6, 14],
      grid: 1,
    },
    lead: { mode: 'motif', timbres: ['vibes', 'flute'], density: [3, 5], grid: 2, maxLen: 6 },
    mix: { reverb: 0.3, delay: 0.26, delayFeedback: 0.42, texture: 0.45 },
    palette: { bg: '#0d1f1c', bg2: '#050c0b', accent: '#f2c879', glow: '#6fd0b0' },
  },

  downtempo: {
    id: 'downtempo',
    name: 'Downtempo',
    description: 'Relaxed, hypnotic trip-hop groove with a warm bass and Rhodes chords',
    bpm: 92,
    bpmMin: 80,
    bpmMax: 104,
    swing: { unit: 16, amount: 0.18 },
    scale: 'dorian',
    gearScale: 'minorPentatonic',
    barsPerChord: 2,
    progressions: [
      [{ root: 0, type: 'm9' }, { root: 5, type: 'm9' }, { root: 3, type: 'maj9' }, { root: 10, type: 'dom13' }],
      [{ root: 0, type: 'm11' }, { root: 8, type: 'maj9s11' }, { root: 3, type: 'maj9' }, { root: 10, type: 'sus9' }],
      [{ root: 0, type: 'm9' }, { root: 10, type: 'six9' }, { root: 8, type: 'maj9' }, { root: 7, type: 'm7' }],
      [{ root: 0, type: 'm9' }, { root: 0, type: 'm9' }, { root: 5, type: 'm11' }, { root: 3, type: 'maj9' }],
    ],
    kit: {
      kick: { pitchStart: 120, pitchEnd: 44, sweep: 0.07, decay: 0.55, click: 0.5, level: 0.95 },
      snare: 'snare',
      hatDecay: 0.05,
    },
    drums: {
      kick: r16([1, 0, 0, 0, 0, 0, 0, 0.35, 0, 0, 0.8, 0, 0, 0, 0, 0.2]),
      snare: r16([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
      ghost: r16([0, 0, 0, 0.12, 0, 0, 0, 0.22, 0, 0.16, 0, 0, 0, 0, 0.1, 0.25]),
      hat: r16([0.95, 0, 0.75, 0.15, 0.95, 0, 0.75, 0.15, 0.95, 0, 0.75, 0.15, 0.95, 0, 0.75, 0.3]),
      openhat: r16([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0]),
      shaker: r16([0.6, 0.35, 0.6, 0.35, 0.6, 0.35, 0.6, 0.35, 0.6, 0.35, 0.6, 0.35, 0.6, 0.35, 0.6, 0.35]),
      conga: r16([0, 0, 0.2, 0, 0, 0, 0.25, 0.15, 0, 0.2, 0, 0, 0, 0.15, 0.3, 0]),
      bongo: r16([0, 0, 0, 0.15, 0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0, 0, 0]),
      wood: [0, 0, 0, 0.3, 0, 0, 0, 0, 0, 0, 0.25, 0],
      tick: r16(new Array(16).fill(0)),
      ride: r16(new Array(16).fill(0)),
    },
    bass: {
      mode: 'pattern',
      timbre: 'synth',
      templates: [
        [{ s: 0, l: 6, d: 'root' }, { s: 7, l: 2, d: 'root' }, { s: 10, l: 3, d: 'fifth' }, { s: 14, l: 2, d: 'octave' }],
        [{ s: 0, l: 5, d: 'root' }, { s: 10, l: 5, d: 'seventh' }],
        [{ s: 0, l: 3, d: 'root' }, { s: 3, l: 4, d: 'root' }, { s: 11, l: 4, d: 'fifth' }],
      ],
    },
    comp: [
      [{ s: 0, l: 15, v: 0.7 }],
      [{ s: 0, l: 9, v: 0.7 }, { s: 10, l: 5, v: 0.5 }],
      [{ s: 0, l: 30, v: 0.65, bar: 0 }, { s: 14, l: 2, v: 0.45, bar: 1 }],
    ],
    gears: {
      timbres: ['kalimba', 'bell', 'marimba'],
      cycles: [16, 12, 24],
      grid: 2,
    },
    lead: { mode: 'motif', timbres: ['flute', 'kalimba'], density: [3, 5], grid: 2, maxLen: 8 },
    mix: { reverb: 0.36, delay: 0.24, delayFeedback: 0.4, texture: 0.9 },
    palette: { bg: '#231a12', bg2: '#0d0906', accent: '#e8a86a', glow: '#b9c98a' },
  },

  nujazz: {
    id: 'nujazz',
    name: 'Nu-Jazz / Broken Beat',
    description: 'Swung broken beats, ride cymbal, walking bass, Rhodes comping and vibraphone',
    bpm: 112,
    bpmMin: 92,
    bpmMax: 126,
    // Eighth note swing: the off-beat eighth is delayed.
    swing: { unit: 8, amount: 0.5 },
    scale: 'dorian',
    gearScale: 'minorPentatonic',
    barsPerChord: 1,
    progressions: [
      [{ root: 5, type: 'm9' }, { root: 10, type: 'dom13' }, { root: 3, type: 'maj9' }, { root: 0, type: 'm9' }],
      [{ root: 0, type: 'm11' }, { root: 10, type: 'dom13' }, { root: 8, type: 'maj9s11' }, { root: 7, type: 'dom9' }],
      [{ root: 0, type: 'm9' }, { root: 5, type: 'dom13' }, { root: 0, type: 'm9' }, { root: 5, type: 'dom13' }],
      [{ root: 3, type: 'maj9' }, { root: 8, type: 'maj9s11' }, { root: 5, type: 'm9' }, { root: 10, type: 'sus9' }],
    ],
    kit: {
      kick: { pitchStart: 130, pitchEnd: 50, sweep: 0.05, decay: 0.35, click: 0.6, level: 0.85 },
      snare: 'snare',
      hatDecay: 0.035,
    },
    drums: {
      // Broken beat: kick avoids the plain four-to-the-floor.
      kick: r16([1, 0, 0, 0.3, 0, 0, 0.55, 0, 0, 0, 0.7, 0, 0, 0.25, 0, 0]),
      snare: r16([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]),
      ghost: r16([0, 0.15, 0, 0.2, 0, 0, 0.15, 0.25, 0, 0.3, 0, 0.2, 0, 0, 0.3, 0.2]),
      hat: r16([0, 0, 0, 0, 0.9, 0, 0, 0, 0, 0, 0, 0, 0.9, 0, 0, 0]),
      openhat: r16(new Array(16).fill(0)),
      ride: r16([1, 0, 0, 0, 1, 0, 0.9, 0, 1, 0, 0, 0, 1, 0, 0.9, 0]),
      shaker: r16([0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0, 0.4, 0]),
      conga: r16([0, 0, 0.25, 0, 0, 0, 0, 0.3, 0, 0, 0.25, 0, 0, 0, 0, 0.3]),
      bongo: r16([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.2, 0, 0]),
      wood: [0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      tick: r16(new Array(16).fill(0)),
    },
    bass: { mode: 'walking', timbre: 'upright' },
    comp: [
      [{ s: 0, l: 3, v: 0.65 }, { s: 6, l: 4, v: 0.55 }],
      [{ s: 2, l: 2, v: 0.55 }, { s: 7, l: 3, v: 0.6 }, { s: 12, l: 2, v: 0.45 }],
      [{ s: 0, l: 2, v: 0.6 }, { s: 3, l: 2, v: 0.5 }, { s: 10, l: 4, v: 0.55 }],
      [{ s: 6, l: 6, v: 0.6 }, { s: 14, l: 2, v: 0.45 }],
    ],
    gears: {
      timbres: ['marimba', 'bell'],
      cycles: [12, 16, 10],
      grid: 2,
    },
    lead: { mode: 'motif', timbres: ['vibes', 'flute'], density: [5, 9], grid: 2, maxLen: 4 },
    mix: { reverb: 0.26, delay: 0.16, delayFeedback: 0.3, texture: 0.6 },
    palette: { bg: '#141a2b', bg2: '#06080f', accent: '#f0b35e', glow: '#8aa8e8' },
  },
};

export const STYLE_ORDER = ['organic', 'downtempo', 'nujazz'];

/**
 * Song form, shared by all styles. It follows a layering principle:
 * introduction, build-up, groove, variation, second groove, resolution.
 * A layer value is a level from 0 to 1. A two-element array is a linear
 * ramp from the first to the second value over the section.
 * "gears" is the number of active interlocking melodic patterns.
 */
export const ARRANGEMENT = [
  {
    name: 'Introduction',
    bars: 8,
    layers: { gears: [1, 2], texture: 1, pad: [0.2, 0.6], perc: [0, 0.4] },
  },
  {
    name: 'Build-up',
    bars: 16,
    layers: { gears: [2, 3], texture: 0.8, pad: 0.6, perc: [0.4, 0.9], hats: [0.2, 0.8], kick: [0, 0.8], keys: [0, 0.5] },
  },
  {
    name: 'Groove',
    bars: 24,
    layers: { gears: [3, 4], texture: 0.5, pad: 0.5, perc: 1, hats: 1, kick: 1, snare: 0.85, bass: 1, keys: 0.6 },
  },
  {
    name: 'Variation',
    bars: 16,
    layers: { gears: [2, 1], texture: 0.9, pad: 0.9, perc: 0.55, hats: 0.5, kick: 0.5, snare: 0.4, bass: 0.7, keys: 0.9, lead: 1 },
  },
  {
    name: 'Groove II',
    bars: 24,
    layers: { gears: [3, 4], texture: 0.5, pad: 0.6, perc: 1, hats: 1, kick: 1, snare: 1, bass: 1, keys: 0.7, lead: 0.6 },
  },
  {
    name: 'Resolution',
    bars: 12,
    layers: { gears: [3, 1], texture: [0.8, 1], pad: [0.7, 0.3], perc: [0.8, 0.2], hats: [0.7, 0], kick: [0.8, 0], snare: [0.6, 0], bass: [0.8, 0], keys: [0.5, 0.2] },
  },
];

/** Level of a layer in a section at a given bar (handles linear ramps). */
export function layerLevel(section, layer, barInSection) {
  const value = section.layers[layer];
  if (value === undefined) return 0;
  if (!Array.isArray(value)) return value;
  const t = section.bars > 1 ? barInSection / (section.bars - 1) : 1;
  return value[0] + (value[1] - value[0]) * t;
}
