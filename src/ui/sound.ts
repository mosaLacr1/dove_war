/**
 * 极简 WebAudio 音效：不依赖任何音频资源，开关默认关闭。
 * 失败时静默处理——声音永远不是关键路径。
 */

type SoundKind = 'move' | 'mine' | 'craft' | 'hit' | 'block' | 'dash' | 'win' | 'lose' | 'error' | 'turn';

let context: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

export function isSoundEnabled(): boolean {
  return enabled;
}

const TONES: Record<SoundKind, { freq: number; type: OscillatorType; dur: number; gain: number }> = {
  move: { freq: 320, type: 'sine', dur: 0.06, gain: 0.05 },
  mine: { freq: 180, type: 'square', dur: 0.08, gain: 0.04 },
  craft: { freq: 520, type: 'triangle', dur: 0.1, gain: 0.05 },
  hit: { freq: 140, type: 'sawtooth', dur: 0.09, gain: 0.06 },
  block: { freq: 240, type: 'square', dur: 0.07, gain: 0.05 },
  dash: { freq: 460, type: 'sine', dur: 0.08, gain: 0.04 },
  win: { freq: 660, type: 'triangle', dur: 0.35, gain: 0.06 },
  lose: { freq: 120, type: 'sawtooth', dur: 0.4, gain: 0.06 },
  error: { freq: 90, type: 'square', dur: 0.08, gain: 0.04 },
  turn: { freq: 380, type: 'sine', dur: 0.1, gain: 0.04 },
};

export function playSound(kind: SoundKind): void {
  if (!enabled) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume();
    const tone = TONES[kind];
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = tone.type;
    osc.frequency.value = tone.freq;
    gain.gain.setValueAtTime(tone.gain, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + tone.dur);
    osc.connect(gain).connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + tone.dur);
  } catch {
    /* 忽略音频错误 */
  }
}
