import type { GameState } from '../../core/types';
import { canCurrentPlayerAct } from '../../core/game';
import { MapBoard } from '../components/MapBoard';
import { SidePanel, type SideTab } from '../components/SidePanel';
import { UnitCard } from '../components/UnitCard';
import type { Coord, GearSlot, ItemId, Unit } from '../../core/types';

interface MapScreenProps {
  game: GameState;
  selectedUnitId: string | null;
  selectedUnit: Unit | null;
  tab: SideTab;
  onTab: (tab: SideTab) => void;
  onCellClick: (coord: Coord) => void;
  onItemClick: (item: ItemId) => void;
  onUnequip: (slot: GearSlot) => void;
  onCraft: (recipeId: string) => void;
  onSmelt: (recipeId: string) => void;
  onFuel: (item: ItemId) => void;
  onDove: () => void;
  onEndTurn: () => void;
  cellMode: 'mine' | 'move';
  onCellModeChange: (mode: 'mine' | 'move') => void;
}

export function MapScreen(props: MapScreenProps) {
  const { game, selectedUnitId, tab, onTab, selectedUnit } = props;
  const isPlayerTurn = game.currentPlayer === 0 && game.phase === 'map';

  return (
    <>
      <main className="board">
        <section className="board-main">
          <MapBoard
            game={game}
            selectedUnitId={selectedUnitId}
            cellMode={props.cellMode}
            onCellClick={props.onCellClick}
          />
          {game.currentPlayer === 1 && game.phase === 'map' && (
            <div className="ai-banner" role="status">
              电脑正在行动…
            </div>
          )}
        </section>

        <aside className="board-side">
          <SidePanel
            game={game}
            tab={tab}
            selectedUnit={selectedUnit}
            onTab={onTab}
            onCraft={props.onCraft}
            onSmelt={props.onSmelt}
            onFuel={props.onFuel}
            onDove={props.onDove}
            onItemClick={props.onItemClick}
          />
        </aside>
      </main>

      <footer className="action-bar">
        <UnitCard game={game} unit={selectedUnit} onUnequip={props.onUnequip} />
        <div className="cell-mode" role="group" aria-label="点击资源格时的行为">
          <span className="muted small">点击资源格</span>
          <button
            type="button"
            className={props.cellMode === 'mine' ? 'seg active' : 'seg'}
            aria-pressed={props.cellMode === 'mine'}
            onClick={() => props.onCellModeChange('mine')}
          >
            挖掘
          </button>
          <button
            type="button"
            className={props.cellMode === 'move' ? 'seg active' : 'seg'}
            aria-pressed={props.cellMode === 'move'}
            onClick={() => props.onCellModeChange('move')}
            title="资源不阻挡移动：切换后可以把斑鸠踩到资源格上"
          >
            移动
          </button>
        </div>
        <div className="end-turn">
          <span className="muted small">
            {canCurrentPlayerAct(game) ? '还有斑鸠可以行动' : '本回合已无可行动斑鸠'}
          </span>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!isPlayerTurn}
            onClick={props.onEndTurn}
            title={isPlayerTurn ? '结束本回合，交出行动权' : '现在不能结束回合'}
          >
            结束回合
          </button>
        </div>
      </footer>
    </>
  );
}
