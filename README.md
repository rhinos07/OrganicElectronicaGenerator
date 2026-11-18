# Organic Electronica Generator

A generative music player for the browser. It composes and synthesizes
endless **melodic organic electronica** in real time: interlocking kalimba and
bell patterns, a warm house groove, downtempo atmosphere and nu-jazz /
broken-beat influences.

All sounds are synthesized with the Web Audio API. The project uses no audio
samples, no build step and no external libraries.

## Run

The app uses ES modules. Browsers do not load modules from `file://` URLs, so
serve the folder with any static web server, for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. GitHub Pages also works without changes.

## Controls

| Control | Function |
| --- | --- |
| Play / Stop (Space) | Start or stop the music |
| Style (1–3) | Organic House, Downtempo, Nu-Jazz / Broken Beat |
| Tempo | Beats per minute, within the range of the style |
| Key | Tonic of the (minor / dorian) key |
| Energy | Density of the drums and percussion |
| Volume (M = mute) | Master volume |
| Layers | Mute or unmute each instrument group |
| New variation (N) | New seed: new harmony, patterns and melodies |
| Export WAV | Renders 2, 4 or 6 minutes of the current settings to a WAV file |
| H | Hide or show the control panel |

Changes of style, key and variation take effect at the start of the next bar.
Settings are saved in the browser's local storage.

## Musical concept

- **Interlocking patterns ("gears").** Up to four short melodic cycles
  (kalimba, bells, marimba) run at the same time. Their lengths differ, for
  example 16, 12, 10 and 6 sixteenth notes. They shift against each other
  slowly, like gears in a clockwork, and create polyrhythms such as 3 against 4.
  Later gears prefer positions that earlier gears leave free, so the patterns
  complement each other instead of doubling.
- **Stable harmony.** Few chords with long durations (minor 9th, minor 11th,
  major 9th, sus chords). The gears use the minor pentatonic scale, so they fit
  every chord.
- **Layering instead of drops.** Every track follows the form
  Introduction → Build-up → Groove → Variation → Groove II → Resolution.
  Layers enter, change and leave gradually. Every 8 bars one gear mutates a
  little, so the repetition stays alive.
- **Steady pulse, free percussion.** A reliable kick, with shakers, hand
  drums, woodblock and metallic ticks around it. Some percussion tables have
  6 or 12 steps and run against the 4/4 bar.
- **Warm, sparse bass**, tied to the kick (with sidechain ducking).
- **Organic texture:** vinyl crackle, an airy noise bed and synthetic birds.

### Styles

| Style | Tempo | Character |
| --- | --- | --- |
| Organic House | 108–126 BPM | Four-to-the-floor, interlocking gears, round bass, long chords |
| Downtempo | 80–104 BPM | Broken trip-hop beat, Rhodes chords, flute or kalimba motifs |
| Nu-Jazz / Broken Beat | 92–126 BPM | Swung broken beat, ride cymbal, walking upright bass, vibraphone |

## Code structure

| File | Purpose |
| --- | --- |
| `index.html`, `css/style.css` | Page and layout |
| `js/main.js` | User interface and real-time playback |
| `js/composer.js` | Generates the music as note events (no audio code, testable in Node.js) |
| `js/styles.js` | Style data and the song form |
| `js/theory.js` | Scales, chords, voicings |
| `js/random.js` | Seeded random number generator |
| `js/sequencer.js` | Schedules events on the audio clock, offline rendering, WAV encoder |
| `js/engine.js` | Mixer channels, reverb, delay, master chain |
| `js/voices.js` | Synthesized instruments |
| `js/visual.js` | Audio-reactive background |

## Tests

```bash
npm test
```

The tests (Node.js 20 or newer) check the composer: determinism of seeds,
valid note events for all styles, the song form and the polymeter of the gears.
