// Tests for the composer. Run with: node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { Composer, STEPS_PER_BAR } from '../js/composer.js';
import { ARRANGEMENT, STYLE_ORDER } from '../js/styles.js';

const SONG_BARS = ARRANGEMENT.reduce((sum, s) => sum + s.bars, 0);

function collect(composer, steps) {
  const all = [];
  for (let i = 0; i < steps; i++) all.push(composer.nextStep());
  return all;
}

test('same seed gives the same music', () => {
  const a = collect(new Composer({ seed: 42 }), 2000);
  const b = collect(new Composer({ seed: 42 }), 2000);
  assert.deepEqual(a, b);
});

test('different seeds give different music', () => {
  const a = collect(new Composer({ seed: 1 }), 2000);
  const b = collect(new Composer({ seed: 2 }), 2000);
  assert.notDeepEqual(a, b);
});

for (const style of STYLE_ORDER) {
  test(`style ${style}: all events are valid for two full songs`, () => {
    const composer = new Composer({ seed: 7, style, key: 4, energy: 0.8 });
    const steps = collect(composer, SONG_BARS * STEPS_PER_BAR * 2);
    const types = new Set();
    for (const { events } of steps) {
      for (const ev of events) {
        types.add(ev.type);
        assert.ok(Number.isFinite(ev.offset), `offset of ${ev.type}`);
        assert.ok(ev.offset > -0.5 && ev.offset < 14, `offset range of ${ev.type}`);
        if (ev.vel !== undefined) assert.ok(ev.vel >= 0 && ev.vel <= 1.2, `velocity of ${ev.type}: ${ev.vel}`);
        if (ev.note !== undefined) assert.ok(Number.isInteger(ev.note) && ev.note >= 24 && ev.note <= 100, `note of ${ev.type}: ${ev.note}`);
        if (ev.notes) for (const n of ev.notes) assert.ok(n >= 36 && n <= 90, `chord note ${n}`);
      }
    }
    for (const t of ['kick', 'snare', 'gear', 'bass', 'keys', 'pad', 'lead', 'texture']) {
      assert.ok(types.has(t), `style ${style} produces ${t}`);
    }
  });
}

test('arrangement follows the song form and starts a new song afterwards', () => {
  const composer = new Composer({ seed: 3 });
  const infos = collect(composer, (SONG_BARS + 1) * STEPS_PER_BAR).map((s) => s.info).filter(Boolean);
  assert.equal(infos[0].section, ARRANGEMENT[0].name);
  assert.equal(infos[0].song, 1);
  const names = [...new Set(infos.slice(0, SONG_BARS).map((i) => i.section))];
  assert.deepEqual(names, ARRANGEMENT.map((s) => s.name));
  assert.equal(infos[SONG_BARS].song, 2);
  assert.equal(infos[SONG_BARS].section, ARRANGEMENT[0].name);
});

test('the introduction has no kick and the groove has one', () => {
  const composer = new Composer({ seed: 5 });
  const steps = collect(composer, 60 * STEPS_PER_BAR);
  const kicksInBars = (from, to) => steps.slice(from * 16, to * 16).flatMap((s) => s.events).filter((e) => e.type === 'kick').length;
  assert.equal(kicksInBars(0, 8), 0);
  assert.ok(kicksInBars(24, 48) >= 24 * 4);
});

test('style and key changes apply at the next bar', () => {
  const composer = new Composer({ seed: 9, style: 'organic', key: 9 });
  collect(composer, 5);
  composer.setStyle('nujazz');
  composer.setKey(2);
  const steps = collect(composer, 11 + 1);
  const info = steps[steps.length - 1].info;
  assert.equal(info.style, 'nujazz');
  assert.equal(info.key, 'D');
});

test('gears use cycles of different lengths (polymeter)', () => {
  const composer = new Composer({ seed: 11 });
  composer.nextStep();
  const cycles = composer.gears.map((g) => g.cycle);
  assert.ok(new Set(cycles).size >= 3, `cycles ${cycles}`);
});
