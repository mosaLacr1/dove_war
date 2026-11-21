import { ITEMS } from '../../core/config/items';
import { gearSlots } from '../../core/selectors';
import type { GameState, GearSlot, Unit } from '../../core/types';
import { armorReduction, attackDamage } from '../../core/units';
import { ItemGlyph } from '../icons';

interface UnitCardProps {
  game: GameState;
  unit: Unit | null;
  onUnequip: (slot: GearSlot) => void;
}

export function UnitCard({ game, unit, onUnequip }: UnitCardProps) {
  if (!unit) {
    return (
      <div className="unit-card is-empty">
        <p className="muted">点击自己的斑鸠来选中它，再点相邻格移动或挖掘。</p>
      </div>
    );
  }

  const isMine = unit.owner === game.currentPlayer;
  return (
    <div className="unit-card">
      <div className="unit-card-head">
        <span className={`player-dot owner-${unit.owner}`} aria-hidden="true" />
        <strong>{unit.id}</strong>
        <span className="muted small">
          {unit.owner === 0 ? '玩家 1' : '电脑'} · HP {Math.round(unit.hp)}/{unit.maxHp}
        </span>
        <span className="pips" aria-label={`剩余行动 ${unit.actionsLeft}`}>
          {Array.from({ length: 2 }).map((_, i) => (
            <i key={i} className={i < unit.actionsLeft ? 'on' : ''} />
          ))}
        </span>
        {!isMine && <span className="tag">敌方</span>}
      </div>

      <div className="unit-stats">
        <span>伤害 {attackDamage(unit.equipment)}</span>
        <span>减伤 {Math.round(armorReduction(unit.equipment) * 100)}%</span>
        {unit.actionsLeft === 0 && <span className="warn-text">本回合行动已用完</span>}
      </div>

      <div className="gear-row">
        {gearSlots().map((slot) => {
          const item = unit.equipment[slot];
          return (
            <div key={slot} className={`gear-slot ${item ? 'filled' : ''}`}>
              <span className="gear-label">
                {slot === 'weapon'
                  ? '武器'
                  : slot === 'offhand'
                    ? '副手'
                    : slot === 'head'
                      ? '头'
                      : slot === 'chest'
                        ? '胸'
                        : slot === 'legs'
                          ? '腿'
                          : '脚'}
              </span>
              {item ? (
                <>
                  <ItemGlyph item={item} />
                  <span className="gear-name">{ITEMS[item].name}</span>
                  <button
                    type="button"
                    className="btn btn-tiny"
                    disabled={!isMine || game.phase !== 'map'}
                    onClick={() => onUnequip(slot)}
                  >
                    卸下
                  </button>
                </>
              ) : (
                <span className="gear-empty">空</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
