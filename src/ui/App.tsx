import { useCallback, useEffect, useRef, useState } from 'react';
import { ITEMS, equipSlotOf } from '../core/config/items';
import {
  addFuel,
  aiTurnStep,
  craftDove,
  craftRecipe,
  createGame,
  endTurn,
  equipItem,
  finishDuel,
  mineResource,
  moveUnit,
  smeltItem,
  unequipItem,
} from '../core/game';
import { isOrthogonallyAdjacent, tileAt } from '../core/map/grid';
import { difficultyOf, type DifficultyId } from '../core/config/difficulty';
import { randomSeed } from '../core/rng';
import type { ActionResult, Coord, GameState, GearSlot, ItemId, Unit } from '../core/types';
import { unitAt } from '../core/units';
import type { SideTab } from './components/SidePanel';
import { Toasts, type Toast } from './components/Toasts';
import { TopBar } from './components/TopBar';
import { Tutorial } from './components/Tutorial';
import { DuelScreen } from './screens/DuelScreen';
import { MapScreen } from './screens/MapScreen';
import { OverScreen } from './screens/OverScreen';
import { TitleScreen } from './screens/TitleScreen';
import { playSound, setSoundEnabled } from './sound';
import { applyTheme, loadTheme, type Theme } from './theme';

const TUTORIAL_KEY = 'dove-war-tutorial-seen-v3';

function tutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
}

function markTutorialSeen(): void {
  try {
    localStorage.setItem(TUTORIAL_KEY, '1');
  } catch {
    /* 隐私模式下忽略 */
  }
}

function actionBudget(state: GameState): number {
  return state.units
    .filter((u) => u.alive && u.owner === state.currentPlayer)
    .reduce((sum, u) => sum + u.actionsLeft, 0);
}

export function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [tab, setTab] = useState<SideTab>('craft');
  /** 点击资源格时的默认行为：挖掘，或踩上去（资源不阻挡移动）。 */
  const [cellMode, setCellMode] = useState<'mine' | 'move'>('mine');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [lastSeed, setLastSeed] = useState<string | null>(null);
  const toastSeq = useRef(1);

  useEffect(() => {
    setSoundEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = toastSeq.current;
    toastSeq.current += 1;
    setToasts((prev) => [...prev.slice(-1), { id, text, kind }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const applyResult = useCallback(
    (result: ActionResult) => {
      if (!result.ok) {
        pushToast(result.message, 'error');
        playSound('error');
        return;
      }
      setGame(result.state);
      if (result.message) pushToast(result.message, 'success');
    },
    [pushToast],
  );

  const startGame = useCallback(
    (seed?: string, diff: DifficultyId = difficulty) => {
      const next = createGame(seed && seed.trim() !== '' ? seed.trim() : randomSeed(), diff);
      setGame(next);
      setDifficulty(diff);
      setLastSeed(next.seed);
      setSelectedUnitId(null);
      setTab('craft');
      setToasts([]);
      pushToast(`新对局 · 种子 ${next.seed}`, 'info');
      playSound('turn');
      if (!tutorialSeen()) {
        setTutorialOpen(true);
        markTutorialSeen();
      }
    },
    [difficulty, pushToast],
  );

  // 自动选中当前玩家一只有行动的斑鸠
  useEffect(() => {
    if (!game || game.phase !== 'map') return;
    const mine = game.units.filter((u) => u.alive && u.owner === game.currentPlayer);
    if (mine.length === 0) return;
    setSelectedUnitId((prev) => {
      const still = mine.find((u) => u.id === prev && u.actionsLeft > 0);
      if (still) return prev;
      return mine.find((u) => u.actionsLeft > 0)?.id ?? mine[0]?.id ?? null;
    });
  }, [game]);

  // 电脑回合：定时推进，消耗行动的动作每次只走一步，合成类动作在一拍内连续处理
  useEffect(() => {
    if (!game || game.phase !== 'map' || game.currentPlayer !== 1) return;
    const pace = difficultyOf(game.difficulty).map.paceMs;
    const timer = window.setTimeout(() => {
      setGame((prev) => {
        if (!prev) return prev;
        let working = prev;
        for (let i = 0; i < 8; i += 1) {
          if (working.phase !== 'map' || working.currentPlayer !== 1) break;
          const before = actionBudget(working);
          const step = aiTurnStep(working);
          if (!step) break;
          working = step.state;
          if (actionBudget(working) < before) break;
        }
        return working;
      });
    }, pace);
    return () => window.clearTimeout(timer);
  }, [game]);

  const selectedUnit: Unit | null = game
    ? (game.units.find((u) => u.id === selectedUnitId && u.alive) ?? null)
    : null;

  const onCellClick = useCallback(
    (coord: Coord) => {
      if (!game || game.phase !== 'map') return;
      const occupant = unitAt(game.units, coord.x, coord.y);
      if (occupant) {
        if (occupant.owner === game.currentPlayer) {
          setSelectedUnitId(occupant.id);
          return;
        }
        pushToast(`${occupant.id} 是敌方斑鸠，正交相邻时才会开战`, 'warn');
        return;
      }
      const unit = game.units.find((u) => u.id === selectedUnitId && u.alive);
      if (!unit || unit.owner !== game.currentPlayer) {
        pushToast('先选中一只自己的斑鸠', 'warn');
        return;
      }

      const tile = tileAt(game.map, coord.x, coord.y);
      const sameCell = unit.x === coord.x && unit.y === coord.y;
      const adjacent = isOrthogonallyAdjacent(unit, coord);

      if (tile !== null && tile !== 'empty') {
        if (!sameCell && !adjacent) {
          pushToast('只能挖掘脚下或正交相邻的资源', 'warn');
          return;
        }
        if (cellMode === 'move' && !sameCell) {
          const moved = moveUnit(game, unit.id, coord);
          if (moved.ok) playSound('move');
          applyResult(moved);
          return;
        }
        const result = mineResource(game, unit.id, coord);
        if (result.ok) playSound('mine');
        applyResult(result);
        return;
      }

      if (!adjacent) {
        pushToast('一次只能移动到正交相邻的格子', 'warn');
        return;
      }
      const result = moveUnit(game, unit.id, coord);
      if (result.ok) playSound('move');
      applyResult(result);
    },
    [applyResult, cellMode, game, pushToast, selectedUnitId],
  );

  const onItemClick = useCallback(
    (item: ItemId) => {
      if (!game) return;
      const def = ITEMS[item];
      const slot = equipSlotOf(item);
      if (def.category === 'tool') {
        pushToast(`${def.name}放在共享库存里即可用于挖掘，不需要装备`, 'info');
        return;
      }
      if (!slot) {
        pushToast(`${def.name}：${def.hint ?? '合成材料'}`, 'info');
        return;
      }
      if (!selectedUnit) {
        pushToast('先选中一只斑鸠再装备', 'warn');
        return;
      }
      const result = equipItem(game, selectedUnit.id, item);
      if (result.ok) playSound('craft');
      applyResult(result);
    },
    [applyResult, game, pushToast, selectedUnit],
  );

  const onUnequip = useCallback(
    (slot: GearSlot) => {
      if (!game || !selectedUnit) return;
      applyResult(unequipItem(game, selectedUnit.id, slot));
    },
    [applyResult, game, selectedUnit],
  );

  const onEndTurn = useCallback(() => {
    if (!game) return;
    applyResult(endTurn(game));
    playSound('turn');
  }, [applyResult, game]);

  const onCopySeed = useCallback(async () => {
    if (!game) return;
    try {
      await navigator.clipboard.writeText(game.seed);
      pushToast(`已复制种子 ${game.seed}`, 'success');
    } catch {
      pushToast(`复制失败，请手动记录：${game.seed}`, 'warn');
    }
  }, [game, pushToast]);

  const cycleSelection = useCallback(() => {
    if (!game) return;
    const mine = game.units.filter((u) => u.alive && u.owner === game.currentPlayer);
    if (mine.length === 0) return;
    const index = mine.findIndex((u) => u.id === selectedUnitId);
    const next = mine[(index + 1) % mine.length] as Unit;
    setSelectedUnitId(next.id);
  }, [game, selectedUnitId]);

  // 地图键盘操作
  useEffect(() => {
    if (!game || game.phase !== 'map' || game.currentPlayer !== 0) return;
    const handler = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const unit = game.units.find((u) => u.id === selectedUnitId && u.alive);
      if (!unit) return;
      const dirs: Record<string, Coord> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
      };
      const dir = dirs[event.key];
      if (dir) {
        event.preventDefault();
        onCellClick({ x: unit.x + dir.x, y: unit.y + dir.y });
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        cycleSelection();
        return;
      }
      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        onEndTurn();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleSelection, game, onCellClick, onEndTurn, selectedUnitId]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  if (!game) {
    return (
      <div className="app app-title">
        <TitleScreen
          onStart={startGame}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((v) => !v)}
          theme={theme}
          onToggleTheme={toggleTheme}
          onOpenTutorial={() => setTutorialOpen(true)}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          lastSeed={lastSeed}
          onRetrySeed={() => lastSeed && startGame(lastSeed)}
        />
        {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}
        <Toasts toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className={`app phase-${game.phase}`}>
      <TopBar
        game={game}
        soundOn={soundOn}
        theme={theme}
        onToggleSound={() => setSoundOn((v) => !v)}
        onToggleTheme={toggleTheme}
        onOpenTutorial={() => setTutorialOpen(true)}
        onCopySeed={onCopySeed}
        onRestart={() => startGame(undefined)}
      />

      {game.phase === 'over' && (
        <OverScreen
          game={game}
          onNewSeed={() => startGame(undefined)}
          onSameSeed={() => startGame(game.seed, game.difficulty)}
          onNewGameWithDifficulty={(id) => startGame(undefined, id)}
        />
      )}

      {game.phase === 'duel' && game.duel && (
        <DuelScreen
          key={game.duel.seed}
          game={game}
          duel={game.duel}
          theme={theme}
          onFinish={(result) => {
            applyResult(finishDuel(game, result));
          }}
        />
      )}

      {game.phase === 'map' && (
        <MapScreen
          game={game}
          selectedUnitId={selectedUnitId}
          selectedUnit={selectedUnit}
          tab={tab}
          onTab={setTab}
          onCellClick={onCellClick}
          onItemClick={onItemClick}
          onUnequip={onUnequip}
          cellMode={cellMode}
          onCellModeChange={setCellMode}
          onCraft={(id) => {
            const result = craftRecipe(game, id);
            if (result.ok) playSound('craft');
            applyResult(result);
          }}
          onSmelt={(id) => {
            const result = smeltItem(game, id);
            if (result.ok) playSound('craft');
            applyResult(result);
          }}
          onFuel={(item) => applyResult(addFuel(game, item))}
          onDove={() => {
            const result = craftDove(game);
            if (result.ok) playSound('craft');
            applyResult(result);
          }}
          onEndTurn={onEndTurn}
        />
      )}

      {tutorialOpen && <Tutorial onClose={() => setTutorialOpen(false)} />}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
