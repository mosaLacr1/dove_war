import { ITEMS } from '../../core/config/items';
import { countOf, inventoryEntries } from '../../core/inventory';
import type { ItemId, PlayerState, Unit } from '../../core/types';
import { ItemGlyph } from '../icons';

interface PlayerPanelProps {
  player: PlayerState;
  units: Unit[];
  isCurrent: boolean;
  onItemClick: (item: ItemId) => void;
  compact?: boolean;
}

export function PlayerPanel({ player, units, isCurrent, onItemClick, compact }: PlayerPanelProps) {
  const entries = inventoryEntries(player.inventory);
  return (
    <section className={`panel player-panel ${isCurrent ? 'is-current' : ''} ${compact ? 'is-compact' : ''}`}>
      <header className="panel-head">
        <span className={`player-dot owner-${player.id}`} aria-hidden="true" />
        <h2>{player.name}</h2>
        {isCurrent && <span className="badge badge-active">行动中</span>}
        <span className="muted small">{units.length} 只斑鸠</span>
      </header>

      <ul className="unit-list">
        {units.map((unit) => (
          <li key={unit.id} className={`unit-chip ${unit.actionsLeft > 0 ? 'has-actions' : ''}`}>
            <span className="unit-chip-id">{unit.id}</span>
            <span className="pips" aria-label={`剩余行动 ${unit.actionsLeft}`}>
              {Array.from({ length: 2 }).map((_, i) => (
                <i key={i} className={i < unit.actionsLeft ? 'on' : ''} />
              ))}
            </span>
            <span className="muted small">
              {unit.equipment.weapon ? ITEMS[unit.equipment.weapon].name : '无武器'}
            </span>
          </li>
        ))}
      </ul>

      <div className="inv-head">
        <h3>共享库存</h3>
        <span className="muted small">
          燃料 {player.furnaceFuel} 点 · 熔炉 {countOf(player.inventory, 'furnace') > 0 ? '已造' : '未造'}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="empty-hint">空手。先去砍木头。</p>
      ) : (
        <div className="inv-grid">
          {entries.map(({ item, count }) => (
            <button
              key={item}
              type="button"
              className={`inv-cell ${ITEMS[item].category}`}
              title={`${ITEMS[item].name} · ${ITEMS[item].hint ?? ''}`}
              onClick={() => onItemClick(item)}
            >
              <ItemGlyph item={item} />
              <span className="inv-count">{count}</span>
              <span className="inv-name">{ITEMS[item].name}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
