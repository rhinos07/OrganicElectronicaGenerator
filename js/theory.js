// Music theory helpers: notes, scales, chords and voicings.

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Scales as semitone offsets from the tonic. */
export const SCALES = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  minorPentatonic: [0, 3, 5, 7, 10],
};

/** Chord qualities as semitone offsets from the chord root. */
export const CHORDS = {
  m7: { intervals: [0, 3, 7, 10], label: 'm7' },
  m9: { intervals: [0, 3, 7, 10, 14], label: 'm9' },
  m11: { intervals: [0, 3, 7, 10, 14, 17], label: 'm11' },
  maj7: { intervals: [0, 4, 7, 11], label: 'maj7' },
  maj9: { intervals: [0, 4, 7, 11, 14], label: 'maj9' },
  maj9s11: { intervals: [0, 4, 7, 11, 14, 18], label: 'maj9#11' },
  dom9: { intervals: [0, 4, 7, 10, 14], label: '9' },
  dom13: { intervals: [0, 4, 10, 14, 21], label: '13' },
  sus9: { intervals: [0, 5, 7, 10, 14], label: '9sus4' },
  six9: { intervals: [0, 4, 7, 9, 14], label: '6/9' },
};

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function pitchClass(midi) {
  return ((midi % 12) + 12) % 12;
}

/** Moves a note by octaves until it is inside [low, low + 12). */
export function foldIntoRange(midi, low) {
  let n = midi;
  while (n < low) n += 12;
  while (n >= low + 12) n -= 12;
  return n;
}

/**
 * Returns the MIDI note of a scale degree. Degrees can be negative or larger
 * than the scale length; they then continue into lower or higher octaves.
 */
export function scaleNote(tonicMidi, scale, degree) {
  const len = scale.length;
  const octave = Math.floor(degree / len);
  const index = ((degree % len) + len) % len;
  return tonicMidi + octave * 12 + scale[index];
}

export function chordName(keyPc, chord) {
  return NOTE_NAMES[pitchClass(keyPc + chord.root)] + CHORDS[chord.type].label;
}

/** Pitch classes of a chord (relative root + quality) in the given key. */
export function chordPitchClasses(keyPc, chord) {
  return CHORDS[chord.type].intervals.map((i) => pitchClass(keyPc + chord.root + i));
}

/**
 * Builds a close, rootless voicing (like a jazz pianist would play it) and
 * moves it by octaves so that it stays near the previous voicing.
 */
export function voiceChord(keyPc, chord, previousMean = 62) {
  let intervals = CHORDS[chord.type].intervals.slice();
  if (intervals.length >= 5) intervals = intervals.filter((i) => i !== 0);
  if (intervals.length > 4) intervals = intervals.filter((i) => i !== 7);
  const rootPc = pitchClass(keyPc + chord.root);
  const notes = intervals.map((i) => rootPc + i).sort((a, b) => a - b);
  const mean = notes.reduce((a, b) => a + b, 0) / notes.length;

  let best = null;
  for (let octave = 3; octave <= 6; octave++) {
    const shift = octave * 12;
    const m = mean + shift;
    // Prefer small movement, but keep the voicing in the middle register.
    const cost = Math.abs(m - previousMean) + 0.8 * Math.max(0, Math.abs(m - 62) - 5);
    if (!best || cost < best.cost) best = { cost, shift };
  }
  return notes.map((n) => n + best.shift);
}

/** Bass note for a chord: chord root plus an interval, in the low register. */
export function bassNote(keyPc, chord, interval = 0, low = 33) {
  return foldIntoRange(keyPc + chord.root, low) + interval;
}

/** Returns the chord's third and seventh as intervals (for walking bass lines). */
export function chordColorIntervals(chord) {
  const ints = CHORDS[chord.type].intervals;
  const third = ints.includes(3) ? 3 : ints.includes(4) ? 4 : 5;
  const seventh = ints.includes(10) ? 10 : ints.includes(11) ? 11 : 9;
  return { third, seventh };
}

/** Moves a note to the nearest chord tone, if one is within maxDistance semitones. */
export function snapToPitchClasses(midi, pcs, maxDistance = 2) {
  for (let d = 0; d <= maxDistance; d++) {
    if (pcs.includes(pitchClass(midi - d))) return midi - d;
    if (pcs.includes(pitchClass(midi + d))) return midi + d;
  }
  return midi;
}
