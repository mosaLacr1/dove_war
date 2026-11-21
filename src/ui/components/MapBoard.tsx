import type { CSSProperties } from 'react';
import type { Coord, GameState, TileKind, Unit } from '../../core/types';
import { cellHints } from '../../core/selectors';
import { RESOURCES } from '../../core/config/items';
import { BALANCE } from '../../core/config/balance';
import { DoveGlyph, TileGlyph } from '../icons';

const W = BALANCE.map.width;
const H = BALANCE.map.height;

const GRID_STYLE = {
  gridTemplateColumns: `repeat(${W}, minmax(0, 1fr))`,
  aspectRatio: `${W} / ${H}`,
  '--map-ratio': W / H,
} as CSSProperties;

interface MapBoardProps {
  game: GameState;
  selectedUnitId: string | null;
  cellMode: 'mine' | 'move';
  onCellClick: (coord: Coord) => void;
}

function tileName(kind: TileKind): string {
  return kind === 'empty' ? '空地' : RESOURCES[kind].name;
}

export function MapBoard({ game, selectedUnitId, cellMode, onCellClick }: MapBoardProps) {
  const selected = game.units.find((u) => u.id === selectedUnitId && u.alive) ?? null;
  const hints = selected
    ? cellHints(game, selected).map((hint) =>
        cellMode === 'move' && hint.kind === 'mine' ? { ...hint, kind: 'move' as const } : hint,
      )
    : [];
  const hintMap = new Map(hints.map((h) => [`${h.coord.x},${h.coord.y}`, h]));
  const unitAt = new Map<string, Unit>();
  for (const u of game.units) {
    if (u.alive) unitAt.set(`${u.x},${u.y}`, u);
  }

  const cells = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const tile = game.map.tiles[y * W + x] ?? 'empty';
      const unit = unitAt.get(`${x},${y}`);
      const hint = hintMap.get(`${x},${y}`);
      const isSelected = unit && unit.id === selectedUnitId;
      const isReady = unit && unit.owner === game.currentPlayer && unit.actionsLeft > 0 && game.phase === 'map';

      const classes = [
        'cell',
        `tile-${tile}`,
        hint ? `hint-${hint.kind}` : '',
        isSelected ? 'is-selected' : '',
        isReady ? 'is-ready' : '',
        unit ? `owner-${unit.owner}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      const label = [
        `第 ${y + 1} 行第 ${x + 1} 列`,
        tileName(tile),
        unit ? `${unit.owner === 0 ? '己方' : '敌方'}斑鸠 ${unit.id}` : '',
        hint?.kind === 'move' ? '可移动' : '',
        hint?.kind === 'mine' ? '可挖掘' : '',
        hint?.kind === 'mine-locked' ? (hint.reason ?? '不可用') : '',
      ]
        .filter(Boolean)
        .join('，');

      cells.push(
        <button
          key={`${x}-${y}`}
          type="button"
          className={classes}
          onClick={() => onCellClick({ x, y })}
          aria-label={label}
          title={unit ? `${unit.id}${unit.equipment.weapon ? ` · 持 ${unit.equipment.weapon}` : ''}` : undefined}
        >
          {tile !== 'empty' && <TileGlyph kind={tile} />}
          {unit && (
            <span className="unit-token" aria-hidden="true">
              <DoveGlyph owner={unit.owner} />
              {unit.actionsLeft > 0 && unit.owner === game.currentPlayer && game.phase === 'map' && (
                <span className="pips">
                  {Array.from({ length: unit.actionsLeft }).map((_, i) => (
                    <i key={i} />
                  ))}
                </span>
              )}
            </span>
          )}
          {hint?.kind === 'mine-locked' && (
            <span className="cell-lock" aria-hidden="true">
              ✕
            </span>
          )}
        </button>,
      );
    }
  }

  return (
    <div className="map-shell">
      <div className="map-grid" role="grid" aria-label={`${H} 行 ${W} 列地图`} style={GRID_STYLE}>
        {cells}
      </div>
      <div className="map-legend">
        {(['wood', 'stone', 'raw_iron_block', 'gold_block', 'diamond'] as const).map((kind) => (
          <span key={kind} className={`legend-item legend-${kind}`}>
            <TileGlyph kind={kind} />
            {RESOURCES[kind].name}
          </span>
        ))}
        <span className="legend-item legend-hint">
          <i className="swatch-move" /> 可移动
        </span>
        <span className="legend-item legend-hint">
          <i className="swatch-mine" /> 可挖掘
        </span>
      </div>
    </div>
  );
}
