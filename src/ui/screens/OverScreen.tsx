import type { GameState } from '../../core/types';
import { playerName } from '../../core/game';
import { DIFFICULTIES, DIFFICULTY_ORDER, type DifficultyId } from '../../core/config/difficulty';

interface OverScreenProps {
  game: GameState;
  onNewSeed: () => void;
  onSameSeed: () => void;
  onNewGameWithDifficulty: (id: DifficultyId) => void;
}

export function OverScreen({ game, onNewSeed, onSameSeed, onNewGameWithDifficulty }: OverScreenProps) {
  const won = game.winner === 0;
  const draw = game.winner === 'draw';
  const lives = {
    p0: game.units.filter((u) => u.alive && u.owner === 0).length,
    p1: game.units.filter((u) => u.alive && u.owner === 1).length,
  };

  return (
    <div className="over-screen">
      <div className={`over-card ${draw ? 'is-draw' : won ? 'is-win' : 'is-lose'}`}>
        <h2 className="over-title">{draw ? '平局' : won ? '胜利' : '失败'}</h2>
        <p className="over-sub">
          {draw
            ? '双方斑鸠同归于尽'
            : `${won ? '电脑' : '玩家 1'} 的斑鸠全部阵亡，${won ? playerName(0) : playerName(1)} 获胜`}
        </p>

        <div className="over-stats">
          <div>
            <span className="muted small">回合</span>
            <strong>{game.round}</strong>
          </div>
          <div>
            <span className="muted small">玩家 1 存活</span>
            <strong>{lives.p0}</strong>
          </div>
          <div>
            <span className="muted small">电脑存活</span>
            <strong>{lives.p1}</strong>
          </div>
          <div>
            <span className="muted small">难度</span>
            <strong>{DIFFICULTIES[game.difficulty].label}</strong>
          </div>
        </div>

        <div className="over-actions">
          <button type="button" className="btn btn-primary btn-large" onClick={onNewSeed}>
            新地图再来一局
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSameSeed}>
            同种子重开
          </button>
        </div>

        <div className="over-difficulty">
          <span className="muted small">换个难度再来</span>
          <div className="diff-row">
            {DIFFICULTY_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`btn btn-small ${game.difficulty === id ? 'is-current' : ''}`}
                onClick={() => onNewGameWithDifficulty(id)}
              >
                {DIFFICULTIES[id].label}
              </button>
            ))}
          </div>
        </div>

        <span className="muted small">种子 {game.seed}</span>
      </div>
    </div>
  );
}
