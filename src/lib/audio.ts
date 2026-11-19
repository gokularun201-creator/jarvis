let ctx: AudioContext | null = null;
let ambient: { stop: () => void } | null = null;

export function ensureAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function beep(freq = 880, duration = 0.08, type: OscillatorType = 'sine', volume = 0.035) {
  const audio = ensureAudio();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime);
  gain.gain.setValueAtTime(0.0001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, audio.currentTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + duration + 0.02);
}

export function bootChord() {
  const audio = ensureAudio();
  if (!audio) return;
  [110, 220, 330, 440].forEach((f, i) => {
    window.setTimeout(() => beep(f, 0.5, 'sine', 0.025), i * 120);
  });
}

export function successChime() {
  beep(660, 0.09, 'triangle', 0.03);
  window.setTimeout(() => beep(990, 0.14, 'triangle', 0.025), 90);
}

export function alertTone() {
  beep(240, 0.18, 'sawtooth', 0.03);
  window.setTimeout(() => beep(180, 0.26, 'sawtooth', 0.03), 190);
}

export function startAmbient() {
  const audio = ensureAudio();
  if (!audio || ambient) return;

  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, audio.currentTime);
  master.gain.exponentialRampToValueAtTime(0.05, audio.currentTime + 2);
  master.connect(audio.destination);

  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(340, audio.currentTime);
  filter.Q.value = 4;
  filter.connect(master);

  const oscs: OscillatorNode[] = [];
  [55, 82.5, 110, 164.81].forEach((f, i) => {
    const osc = audio.createOscillator();
    const g = audio.createGain();
    osc.type = i % 2 === 0 ? 'sawtooth' : 'sine';
    osc.frequency.value = f;
    g.gain.value = i === 3 ? 0.12 : 0.32;
    osc.connect(g).connect(filter);
    osc.start();
    oscs.push(osc);
  });

  const lfo = audio.createOscillator();
  const lfoGain = audio.createGain();
  lfo.frequency.value = 0.06;
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();

  const shimmer = audio.createOscillator();
  const shimmerGain = audio.createGain();
  shimmer.type = 'sine';
  shimmer.frequency.value = 1320;
  shimmerGain.gain.value = 0.006;
  const shLfo = audio.createOscillator();
  const shLfoGain = audio.createGain();
  shLfo.frequency.value = 0.13;
  shLfoGain.gain.value = 0.005;
  shLfo.connect(shLfoGain).connect(shimmerGain.gain);
  shimmer.connect(shimmerGain).connect(master);
  shimmer.start();
  shLfo.start();

  ambient = {
    stop: () => {
      const now = audio.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      window.setTimeout(() => {
        oscs.forEach((o) => o.stop());
        lfo.stop();
        shimmer.stop();
        shLfo.stop();
      }, 900);
      ambient = null;
    },
  };
}

export function stopAmbient() {
  ambient?.stop();
  ambient = null;
}
