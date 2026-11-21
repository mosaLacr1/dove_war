import { useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyId } from '../../core/config/difficulty';

interface TitleScreenProps {
  onStart: (seed?: string) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenTutorial: () => void;
  difficulty: DifficultyId;
  onDifficultyChange: (id: DifficultyId) => void;
  lastSeed: string | null;
  onRetrySeed: () => void;
}

export function TitleScreen({
  onStart,
  soundOn,
  onToggleSound,
  theme,
  onToggleTheme,
  onOpenTutorial,
  difficulty,
  onDifficultyChange,
  lastSeed,
  onRetrySeed,
}: TitleScreenProps) {
  const [seed, setSeed] = useState('');

  return (
    <div className="title-screen">
      <div className="title-art" aria-hidden="true">
        <svg viewBox="0 0 320 120" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M40 78c18-6 30-18 38-32 5-9 14-14 24-14 12 0 21 9 21 21 0 7-3 13-8 17l12 8-17 4c-5 12-17 20-31 20-18 0-33-11-39-24z" />
          <circle cx="119" cy="45" r="6" />
          <path d="M126 41l12 3-12 4" />
          <path d="M60 66c-9 4-15 12-17 21" />
          <path d="M52 78l-16 9 5-16" />
        </svg>
        <svg viewBox="0 0 320 120" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flip">
          <path d="M40 78c18-6 30-18 38-32 5-9 14-14 24-14 12 0 21 9 21 21 0 7-3 13-8 17l12 8-17 4c-5 12-17 20-31 20-18 0-33-11-39-24z" />
          <circle cx="119" cy="45" r="6" />
          <path d="M126 41l12 3-12 4" />
          <path d="M60 66c-9 4-15 12-17 21" />
          <path d="M52 78l-16 9 5-16" />
        </svg>
      </div>

      <h1 className="title">斑鸠大战</h1>
      <p className="subtitle">回合制资源争夺 · 横版 60 秒决斗</p>

      <div className="diff-picker" role="radiogroup" aria-label="电脑难度">
        {DIFFICULTY_ORDER.map((id) => {
          const item = DIFFICULTIES[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={difficulty === id}
              className={`diff-card ${difficulty === id ? 'active' : ''} diff-${id}`}
              onClick={() => onDifficultyChange(id)}
            >
              <strong>{item.label}</strong>
              <span>{item.desc}</span>
            </button>
          );
        })}
      </div>

      <form
        className="title-form"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(seed.trim() || undefined);
        }}
      >
        <input
          className="seed-input"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          placeholder="可选：输入种子复现地图"
          aria-label="地图种子"
          maxLength={24}
        />
        <button type="submit" className="btn btn-primary btn-large">
          开始对局
        </button>
      </form>

      <div className="title-links">
        <button type="button" className="btn btn-ghost" onClick={() => onStart(undefined)}>
          随机种子
        </button>
        {lastSeed && (
          <button type="button" className="btn btn-ghost" onClick={onRetrySeed}>
            重玩 {lastSeed}
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onOpenTutorial}>
          新手教程
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleTheme}>
          {theme === 'light' ? '深色主题' : '浅色主题'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSound} aria-pressed={soundOn}>
          音效 {soundOn ? '开' : '关'}
        </button>
      </div>

      <ul className="title-rules">
        <li>每只斑鸠每回合 2 次行动，移动与挖掘各消耗 1 次。</li>
        <li>空手砍木头，木板 → 工作台 → 木镐，是整条科技线的起点。</li>
        <li>正交相邻即开战：鼠标左键出手、S 格挡、双击 A/D 冲刺。</li>
      </ul>
    </div>
  );
}
