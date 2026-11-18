// Audio-reactive background: an organic, breathing shape and drifting spores.

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export class Visualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.analyser = null;
    this.colors = null;
    this.target = null;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.levels = { bass: 0, mid: 0, high: 0 };
    this.spores = Array.from({ length: 70 }, () => this.newSpore(true));
    this.resize = this.resize.bind(this);
    addEventListener('resize', this.resize);
    this.resize();
  }

  newSpore(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.05,
      r: 0.6 + Math.random() * 2.2,
      speed: 0.00025 + Math.random() * 0.0007,
      phase: Math.random() * Math.PI * 2,
    };
  }

  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.width = innerWidth;
    this.height = innerHeight;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setAnalyser(analyser) {
    this.analyser = analyser;
    if (analyser) this.bins = new Uint8Array(analyser.frequencyBinCount);
  }

  setPalette(palette) {
    const p = {
      bg: hexToRgb(palette.bg), bg2: hexToRgb(palette.bg2),
      accent: hexToRgb(palette.accent), glow: hexToRgb(palette.glow),
    };
    this.target = p;
    if (!this.colors) this.colors = JSON.parse(JSON.stringify(p));
  }

  start() {
    const loop = (time) => {
      this.frame(time / 1000);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Average level of a frequency band, 0..1. */
  band(fromHz, toHz) {
    const a = this.analyser;
    const hzPerBin = a.context.sampleRate / a.fftSize;
    const from = Math.max(1, Math.floor(fromHz / hzPerBin));
    const to = Math.max(from + 1, Math.floor(toHz / hzPerBin));
    let sum = 0;
    for (let i = from; i < to; i++) sum += this.bins[i];
    return sum / (to - from) / 255;
  }

  frame(time) {
    const { g, width: w, height: h } = this;
    if (!this.colors) return;
    for (const k of Object.keys(this.colors)) this.colors[k] = mix(this.colors[k], this.target[k], 0.02);
    const c = this.colors;

    if (this.analyser) {
      this.analyser.getByteFrequencyData(this.bins);
      const smooth = (key, value) => {
        this.levels[key] += (value - this.levels[key]) * 0.25;
      };
      smooth('bass', this.band(30, 140));
      smooth('mid', this.band(300, 2000));
      smooth('high', this.band(3000, 12000));
    }
    const { bass, mid, high } = this.levels;
    const motion = this.reducedMotion ? 0.3 : 1;

    // Background.
    const bg = g.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.8);
    bg.addColorStop(0, rgba(mix(c.bg, c.glow, 0.08 + bass * 0.12 * motion), 1));
    bg.addColorStop(1, rgba(c.bg2, 1));
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // Organic shape: three layers, each moved by another frequency band.
    const cx = w / 2;
    // On narrow screens the control panel covers the lower half.
    const cy = h * (w < 640 ? 0.24 : 0.42);
    const base = Math.min(w, h) * 0.17;
    const layers = [
      { color: c.glow, alpha: 0.16, scale: 1.35, level: bass, speed: 0.11, lobes: 3 },
      { color: c.accent, alpha: 0.2, scale: 1.0, level: mid, speed: -0.17, lobes: 5 },
      { color: mix(c.accent, [255, 255, 255], 0.5), alpha: 0.22, scale: 0.62, level: high, speed: 0.23, lobes: 7 },
    ];
    g.globalCompositeOperation = 'lighter';
    for (const layer of layers) {
      const points = 90;
      const radius = base * layer.scale * (1 + layer.level * 0.45 * motion);
      g.beginPath();
      for (let i = 0; i <= points; i++) {
        const a = (i / points) * Math.PI * 2;
        const wobble =
          Math.sin(a * layer.lobes + time * layer.speed * 6 * motion) * 0.08 +
          Math.sin(a * (layer.lobes + 2) - time * layer.speed * 4 * motion) * 0.05 * (0.5 + layer.level);
        const r = radius * (1 + wobble);
        const x = cx + Math.cos(a + time * layer.speed * motion) * r;
        const y = cy + Math.sin(a + time * layer.speed * motion) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      const fill = g.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.2);
      fill.addColorStop(0, rgba(layer.color, layer.alpha + layer.level * 0.25));
      fill.addColorStop(1, rgba(layer.color, 0));
      g.fillStyle = fill;
      g.fill();
    }

    // Spores drifting upwards.
    for (const s of this.spores) {
      s.y -= s.speed * (1 + mid * 2) * motion;
      s.x += Math.sin(time * 0.5 + s.phase) * 0.0003 * motion;
      if (s.y < -0.05) Object.assign(s, this.newSpore(false));
      const r = s.r * (1 + high * 1.5);
      g.fillStyle = rgba(c.accent, 0.25 + high * 0.4);
      g.beginPath();
      g.arc(s.x * w, s.y * h, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}
