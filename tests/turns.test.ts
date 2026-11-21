import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { craftDove, createGame, endTurn, mineResource, moveUnit } from '../src/core/game';
import { setTile } from '../src/core/map/grid';
import type { GameState, Unit } from '../src/core/types';

/** 所有坐标都从出生点推导，避免把地图尺寸写死在测试里。 */
const S = { x: BALANCE.map.spawn[0].x, y: BALANCE.map.spawn[0].y };

function unit(state: GameState, id: string): Unit {
  const found = state.units.find((u) => u.id === id);
  if (!found) throw new Error(`找不到 ${id}`);
  return found;
}

describe('行动与回合', () => {
  it('每只斑鸠每回合有 2 次行动（玩家不共享）', () => {
    const state = createGame('TURN-1');
    expect(unit(state, 'p1-1').actionsLeft).toBe(BALANCE.actionsPerDove);
    expect(unit(state, 'p2-1').actionsLeft).toBe(BALANCE.actionsPerDove);
  });

  it('移动消耗 1 次行动；两次用完后自动交给对手', () => {
    const state = createGame('TURN-2');
    const first = moveUnit(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(first.ok).toBe(true);
    expect(unit(first.state, 'p1-1').actionsLeft).toBe(1);
    expect(first.state.currentPlayer).toBe(0);

    const second = moveUnit(first.state, 'p1-1', { x: S.x + 2, y: S.y });
    expect(second.ok).toBe(true);
    expect(unit(second.state, 'p1-1').actionsLeft).toBe(0);
    expect(second.state.currentPlayer).toBe(1);
    expect(second.state.round).toBe(1);
  });

  it('完成后双人回合进入新回合，行动被重置', () => {
    const state = createGame('TURN-3');
    const afterP0 = endTurn(state).state;
    expect(afterP0.currentPlayer).toBe(1);
    expect(afterP0.round).toBe(1);

    const afterP1 = endTurn(afterP0).state;
    expect(afterP1.currentPlayer).toBe(0);
    expect(afterP1.round).toBe(2);
    expect(unit(afterP1, 'p1-1').actionsLeft).toBe(BALANCE.actionsPerDove);
  });

  it('不能操作对手的斑鸠，也不能斜向移动', () => {
    const state = createGame('TURN-4');
    const enemyMove = moveUnit(state, 'p2-1', { x: S.x + 8, y: S.y });
    expect(enemyMove.ok).toBe(false);
    expect(enemyMove.message).toContain('对手');

    const diagonal = moveUnit(state, 'p1-1', { x: S.x + 1, y: S.y + 1 });
    expect(diagonal.ok).toBe(false);
    expect(diagonal.message).toContain('斜向');
  });

  it('不能移动到已被占据的格子', () => {
    const state = createGame('TURN-5');
    state.units[1].x = S.x + 1;
    state.units[1].y = S.y;
    const result = moveUnit(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('占据');
  });

  it('行动耗尽的斑鸠不能继续行动', () => {
    const state = createGame('TURN-6');
    state.units[0].actionsLeft = 0;
    const result = moveUnit(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('用完');
  });
});

describe('挖掘', () => {
  it('空手可以挖木头，产物进入共享库存，格子变成空地', () => {
    const state = createGame('MINE-1');
    setTile(state.map, S.x + 1, S.y, 'wood');
    const result = mineResource(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(result.ok).toBe(true);
    expect(result.state.players[0].inventory.log).toBe(1);
    expect(result.state.map.tiles[S.y * BALANCE.map.width + (S.x + 1)]).toBe('empty');
    expect(unit(result.state, 'p1-1').actionsLeft).toBe(1);
  });

  it('没有木镐时无法挖石头，并说明原因', () => {
    const state = createGame('MINE-2');
    setTile(state.map, S.x + 1, S.y, 'stone');
    const blocked = mineResource(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(blocked.ok).toBe(false);
    expect(blocked.message).toContain('木镐');

    state.players[0].inventory = { wooden_pickaxe: 1 };
    const allowed = mineResource(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(allowed.ok).toBe(true);
    expect(allowed.state.players[0].inventory.cobblestone).toBe(1);
  });

  it('生铁块需要石镐，金块与钻石需要铁镐', () => {
    const state = createGame('MINE-3');
    setTile(state.map, S.x + 1, S.y, 'raw_iron_block');
    setTile(state.map, S.x, S.y - 1, 'gold_block');
    setTile(state.map, S.x, S.y + 1, 'diamond');

    expect(mineResource(state, 'p1-1', { x: S.x + 1, y: S.y }).ok).toBe(false);

    state.players[0].inventory = { stone_pickaxe: 1 };
    expect(mineResource(state, 'p1-1', { x: S.x + 1, y: S.y }).ok).toBe(true);
    expect(mineResource(state, 'p1-1', { x: S.x, y: S.y - 1 }).ok).toBe(false);

    state.players[0].inventory = { iron_pickaxe: 1 };
    expect(mineResource(state, 'p1-1', { x: S.x, y: S.y - 1 }).ok).toBe(true);
  });

  it('可以挖掘自己脚下的资源', () => {
    const state = createGame('MINE-4');
    setTile(state.map, S.x, S.y, 'wood');
    const result = mineResource(state, 'p1-1', { x: S.x, y: S.y });
    expect(result.ok).toBe(true);
    expect(result.state.players[0].inventory.log).toBe(1);
  });

  it('不能挖太远或空地', () => {
    const state = createGame('MINE-5');
    setTile(state.map, S.x + 1, S.y, 'empty');
    const far = mineResource(state, 'p1-1', { x: S.x + 5, y: S.y });
    expect(far.ok).toBe(false);

    const empty = mineResource(state, 'p1-1', { x: S.x + 1, y: S.y });
    expect(empty.ok).toBe(false);
    expect(empty.message).toContain('没有');
  });
});

describe('新斑鸠入场时机', () => {
  it('当回合行动为 0，下一回合才恢复', () => {
    const state = createGame('SPAWN-1');
    state.players[0].inventory = { crafting_table: 1, log: 6, planks: 4 };
    const result = craftDove(state);
    expect(result.ok).toBe(true);

    const spawned = result.state.units.filter((u) => u.owner === 0);
    expect(spawned).toHaveLength(2);
    const dove = spawned[1] as Unit;
    expect(dove.actionsLeft).toBe(0);
    expect(dove.spawnRound).toBe(1);

    const tooEarly = moveUnit(result.state, dove.id, { x: dove.x + 1, y: dove.y });
    expect(tooEarly.ok).toBe(false);

    const afterP0 = endTurn(result.state).state;
    const afterP1 = endTurn(afterP0).state;
    expect(afterP1.round).toBe(2);
    expect(unit(afterP1, dove.id).actionsLeft).toBe(BALANCE.actionsPerDove);
  });
});
