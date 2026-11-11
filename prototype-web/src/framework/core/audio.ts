/**
 * Placeholder sound effects, synthesised with Web Audio (no files to load, so boot stays fast).
 * A real theme replaces these with recorded sounds using the same names (design guide section 5).
 */
export type Sfx = 'click' | 'spin' | 'reelStop' | 'scatter' | 'win' | 'pop' | 'multUp' | 'toWild' | 'fly' | 'bigWin' | 'coin' | 'fsIntro' | 'anticipation' | 'retrigger';

export class SoundFx {
  private ctx: BaseAudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private _muted: boolean;

  constructor() {
    let saved: string | null = null;
    try { saved = localStorage.getItem('sfxMuted'); } catch { /* storage blocked */ }
    this._muted = saved === '1';
  }

  get muted(): boolean { return this._muted; }
  setMuted(m: boolean): void {
    this._muted = m;
    try { localStorage.setItem('sfxMuted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  /** Uses a given context instead of creating one. The sound exporter passes an OfflineAudioContext to render files. */
  useContext(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this._muted ? 0 : 0.5;
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate * 0.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Browsers only allow sound after a tap: call on the first pointerdown. */
  unlock(): void {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.useContext(new Ctx());
    }
    const ctx = this.ctx as AudioContext | null;
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  /** level: scatter number, multiplier step or win size, used for pitch. */
  play(name: Sfx, level = 0): void {
    const c = this.ctx;
    if (!c || this._muted) return;
    const t = c.currentTime;
    switch (name) {
      case 'click': this.tone(1400, t, 0.04, 'square', 0.12); break;
      case 'spin': this.noise(t, 0.35, 400, 2400, 0.25); break;
      case 'reelStop': this.tone(110, t, 0.09, 'sine', 0.5, 60); this.noise(t, 0.05, 800, 800, 0.15); break;
      case 'scatter': { const f = 880 * Math.pow(1.26, level); this.tone(f, t, 0.35, 'triangle', 0.35); this.tone(f * 2, t + 0.02, 0.25, 'sine', 0.15); break; }
      case 'win': [523, 659, 784].forEach((f, i) => this.tone(f * (1 + level * 0.06), t + i * 0.06, 0.18, 'triangle', 0.3)); break;
      case 'pop': this.tone(600, t, 0.08, 'sine', 0.3, 1200); break;
      case 'multUp': { const f = 330 * Math.pow(1.19, level); this.tone(f, t, 0.25, 'sawtooth', 0.15, f * 2); this.tone(f * 1.5, t + 0.05, 0.3, 'triangle', 0.25); break; }
      case 'toWild': [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, t + i * 0.04, 0.15, 'sine', 0.2)); break;
      case 'fly': this.noise(t, 0.25, 2000, 6000, 0.12); this.tone(700, t, 0.25, 'sine', 0.1, 1400); break;
      case 'coin': this.tone(2200 + Math.random() * 600, t, 0.07, 'square', 0.06); break;
      case 'bigWin': {
        // level 0 = big, 1 = super, 2 = ultra: each tier adds higher notes, more length and a rising sweep.
        const notes = [262, 330, 392, 523, ...(level >= 1 ? [659, 784] : []), ...(level >= 2 ? [1047, 1319] : [])];
        notes.forEach((f, i) => { this.tone(f, t + i * 0.12, 0.9 + level * 0.3, 'sawtooth', 0.12); this.tone(f * 2, t + i * 0.12, 0.9 + level * 0.3, 'triangle', 0.15); });
        if (level >= 1) this.noise(t, 0.8 + level * 0.4, 400, 6000, 0.14);
        break;
      }
      case 'retrigger': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, t + i * 0.07, 0.5, 'triangle', 0.25)); this.noise(t, 0.5, 600, 7000, 0.12); break;
      case 'fsIntro': [392, 494, 587, 784].forEach((f, i) => this.tone(f, t + i * 0.09, 0.6, 'triangle', 0.25)); this.noise(t, 0.6, 300, 5000, 0.12); break;
      case 'anticipation': this.tone(220, t, 0.8, 'sawtooth', 0.08, 440); break;
    }
  }

  private tone(freq: number, at: number, dur: number, type: OscillatorType, vol: number, toFreq?: number): void {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master!);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private noise(at: number, dur: number, f1: number, f2: number, vol: number): void {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(f1, at);
    f.frequency.exponentialRampToValueAtTime(f2, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(at);
    src.stop(at + dur);
  }
}

export const audio = new SoundFx();
