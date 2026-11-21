import type { GameState } from '../../core/types';
import { playerName } from '../../core/game';
import { DIFFICULTIES } from '../../core/config/difficulty';
import type { Theme } from '../theme';

interface TopBarProps {
  game: GameState;
  soundOn: boolean;
  theme: Theme;
  onToggleSound: () => void;
  onToggleTheme: () => void;
  onOpenTutorial: () => void;
  onCopySeed: () => void;
  onRestart: () => void;
}

function ThemeIcon({ theme }: { theme: Theme }) {
  return (
    <svg viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      {theme === 'light' ? (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6" />
        </>
      )}
    </svg>
  );
}

export function TopBar({
  game,
  soundOn,
  theme,
  onToggleSound,
  onToggleTheme,
  onOpenTutorial,
  onCopySeed,
  onRestart,
}: TopBarProps) {
  const turnLabel =
    game.phase === 'duel'
      ? '决斗中 · 地图已暂停'
      : game.phase === 'over'
        ? '对局结束'
        : `${playerName(game.currentPlayer)} 行动中`;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>斑鸠大战</h1>
      </div>

      <div className="turn-block">
        <span className="turn-round">第 {game.round} 回合</span>
        <span className={`turn-current owner-${game.currentPlayer}`}>{turnLabel}</span>
        <span className={`diff-badge diff-${game.difficulty}`}>{DIFFICULTIES[game.difficulty].label}</span>
      </div>

      <div className="topbar-actions">
        <span className="seed-chip" title="当前地图种子（可复现）">
          种子 <code>{game.seed}</code>
        </span>
        <button type="button" className="btn btn-ghost" onClick={onCopySeed}>
          复制种子
        </button>
        <button type="button" className="btn btn-ghost icon-btn" onClick={onOpenTutorial} aria-label="打开教程" title="教程">
          ?
        </button>
        <button type="button" className="btn btn-ghost icon-btn" onClick={onToggleTheme} aria-label="切换主题" title="切换主题">
          <ThemeIcon theme={theme} />
        </button>
        <button type="button" className="btn btn-ghost" onClick={onToggleSound} aria-pressed={soundOn}>
          音效 {soundOn ? '开' : '关'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          重开
        </button>
      </div>
    </header>
  );
}
