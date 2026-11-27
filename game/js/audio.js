// Island Hopper — all sound is synthesized with WebAudio: no audio files.
// An engine hum follows the throttle, wind follows the speed, and short
// blips mark rings, landings and crashes. Everything starts on the first
// gesture so browsers allow it, and M toggles mute.
'use strict';

const AudioEngine = {
  ctx: null,
  master: null,
  engineOsc1: null,
  engineOsc2: null,
  engineGain: null,
  windSource: null,
  windGain: null,
  windFilter: null,
  muted: false,
  started: false,

  start() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.buildEngineHum();
      this.buildWind();
      this.started = true;
    } catch (e) {
      this.started = false;
    }
  },

  buildEngineHum() {
    const ctx = this.ctx;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 68;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 34;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.4;
    this.engineOsc1.connect(filter);
    this.engineOsc2.connect(osc2Gain);
    osc2Gain.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc1.start();
    this.engineOsc2.start();
  },

  buildWind() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 700;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.windSource.start();
  },

  // Called every frame while flying: throttle 0..1, speed in knots.
  update(throttle, speed, flying) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const hum = flying ? 0.05 + throttle * 0.11 : 0.0;
    this.engineGain.gain.setTargetAtTime(hum, t, 0.08);
    const freq = 52 + throttle * 66 + speed * 0.12;
    this.engineOsc1.frequency.setTargetAtTime(freq, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(freq * 0.5, t, 0.08);
    const wind = flying ? clamp((speed - 55) / 260, 0, 0.16) : 0;
    this.windGain.gain.setTargetAtTime(wind, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(500 + speed * 3, t, 0.15);
  },

  blip(freq, dur, type, vol, when) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  ringChime() {
    this.blip(880, 0.16, 'sine', 0.25, 0);
    this.blip(1318, 0.22, 'sine', 0.22, 0.07);
  },

  landThud() {
    this.blip(140, 0.18, 'triangle', 0.3, 0);
    this.blip(660, 0.3, 'sine', 0.18, 0.08);
    this.blip(990, 0.34, 'sine', 0.15, 0.16);
  },

  crashNoise() {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const len = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain);
    gain.connect(this.master);
    src.start(t);
    this.blip(90, 0.4, 'sawtooth', 0.25, 0);
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  },
};
