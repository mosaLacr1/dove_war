import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { findTriggers, pairKey, pruneCooldowns } from '../src/core/adjacency';
import { createGame, finishDuel, moveUnit } from '../src/core/game';
import { createUnit } from '../src/core/units';
import type { DuelResult, GameState } from '../src/core/types';

/** 坐标从出生点推导，避免把地图尺寸写死。 */
const S = { x: BALANCE.map.spawn[0].x, y: BALANCE.map.spawn[0].y };

function place(state: GameState, id: string, x: number, y: number): void {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`找不到 ${id}`);
  unit.x = x;
  unit.y = y;
}

function drawResult(state: GameState): DuelResult {
  const duel = state.duel;
  if (!duel) throw new Error('当前没有决斗');
  return {
    kind: 'draw',
    winnerUnitId: null,
    loserUnitId: null,
    leftUnitId: duel.left.unitId,
    rightUnitId: duel.right.unitId,
    leftHp: 100,
    rightHp: 100,
    reason: '时间到，双方剩余血量相同，判定平局',
  };
}

describe('决斗触发', () => {
  it('正交相邻触发，斜角与远距离不触发', () => {
    const state = createGame('ADJ-1');
    place(state, 'p2-1', S.x + 1, S.y);
    expect(findTriggers(state.units, [])).toHaveLength(1);

    place(state, 'p2-1', S.x + 1, S.y + 1); // 斜角
    expect(findTriggers(state.units, [])).toHaveLength(0);

    place(state, 'p2-1', S.x + 2, S.y); // 距离 2
    expect(findTriggers(state.units, [])).toHaveLength(0);
  });

  it('同阵营斑鸠相邻不会触发', () => {
    const state = createGame('ADJ-2');
    state.units.push(createUnit({ id: 'p1-2', owner: 0, x: S.x + 1, y: S.y, spawnRound: 0, actionsLeft: 2 }));
    expect(findTriggers(state.units, [])).toHaveLength(0);
  });

  it('多组同时满足时按 pair 键字典序确定性排序', () => {
    const state = createGame('ADJ-3');
    // 在远离出生点的位置再放一对相邻的敌对斑鸠
    state.units.push(createUnit({ id: 'p1-2', owner: 0, x: S.x + 4, y: S.y - 2, spawnRound: 0, actionsLeft: 2 }));
    state.units.push(createUnit({ id: 'p2-2', owner: 1, x: S.x + 5, y: S.y - 2, spawnRound: 0, actionsLeft: 2 }));
    place(state, 'p1-1', S.x, S.y);
    place(state, 'p2-1', S.x + 1, S.y);

    const keys = findTriggers(state.units, []).map((t) => pairKey(t.aId, t.bId));
    expect(keys).toEqual([pairKey('p1-1', 'p2-1'), pairKey('p1-2', 'p2-2')].sort());
  });

  it('移到相邻格立即进入决斗，左方固定为玩家 1 的斑鸠', () => {
    const state = createGame('ADJ-4');
    place(state, 'p2-1', S.x + 1, S.y + 1);
    const moved = moveUnit(state, 'p1-1', { x: S.x, y: S.y + 1 });
    expect(moved.ok).toBe(true);
    expect(moved.state.phase).toBe('duel');
    expect(moved.state.duel?.left.unitId).toBe('p1-1');
    expect(moved.state.duel?.right.unitId).toBe('p2-1');
  });

  it('冷却期内不重复触发，脱离相邻后冷却被清除', () => {
    const state = createGame('ADJ-5');
    place(state, 'p2-1', S.x + 1, S.y);
    const key = pairKey('p1-1', 'p2-1');
    expect(findTriggers(state.units, [key])).toHaveLength(0);

    expect(pruneCooldowns([key], state.units)).toEqual([key]);
    place(state, 'p2-1', S.x + 4, S.y);
    expect(pruneCooldowns([key], state.units)).toEqual([]);
  });
});

describe('决斗与地图衔接', () => {
  it('平局后双方都存活，记录冷却避免立刻重开', () => {
    const state = createGame('LINK-1');
    place(state, 'p2-1', S.x + 1, S.y + 1);
    const moved = moveUnit(state, 'p1-1', { x: S.x, y: S.y + 1 });
    expect(moved.ok).toBe(true);
    expect(moved.state.phase).toBe('duel');

    const finished = finishDuel(moved.state, drawResult(moved.state));
    expect(finished.ok).toBe(true);
    expect(finished.state.phase).toBe('map');
    expect(finished.state.duel).toBeNull();
    expect(finished.state.units.filter((u) => u.alive)).toHaveLength(2);
    expect(finished.state.cooldowns).toContain(pairKey('p1-1', 'p2-1'));
    expect(findTriggers(finished.state.units, finished.state.cooldowns)).toHaveLength(0);
  });

  it('击败对手后失败方斑鸠被移除，装备不掉落', () => {
    const state = createGame('LINK-2');
    state.units[0].equipment.weapon = 'iron_sword';
    place(state, 'p2-1', S.x + 1, S.y + 1);
    const moved = moveUnit(state, 'p1-1', { x: S.x, y: S.y + 1 });
    expect(moved.state.phase).toBe('duel');

    const duel = moved.state.duel;
    if (!duel) throw new Error('缺少决斗状态');
    const killResult: DuelResult = {
      kind: 'ko',
      winnerUnitId: duel.right.unitId,
      loserUnitId: duel.left.unitId,
      leftUnitId: duel.left.unitId,
      rightUnitId: duel.right.unitId,
      leftHp: 0,
      rightHp: 62,
      reason: '击倒对手获胜',
    };

    const finished = finishDuel(moved.state, killResult);
    expect(finished.ok).toBe(true);
    const loser = finished.state.units.find((u) => u.id === 'p1-1');
    expect(loser?.alive).toBe(false);
    expect(finished.state.players[0].inventory.iron_sword).toBeUndefined();
    expect(finished.state.phase).toBe('over');
    expect(finished.state.winner).toBe(1);
  });

  it('决斗结束后若仍有待处理触发，按顺序继续开下一场', () => {
    const state = createGame('LINK-3');
    state.units.push(createUnit({ id: 'p1-2', owner: 0, x: S.x + 4, y: S.y - 2, spawnRound: 0, actionsLeft: 2 }));
    state.units.push(createUnit({ id: 'p2-2', owner: 1, x: S.x + 5, y: S.y - 2, spawnRound: 0, actionsLeft: 2 }));
    place(state, 'p2-1', S.x + 1, S.y + 1);

    const moved = moveUnit(state, 'p1-1', { x: S.x, y: S.y + 1 });
    expect(moved.state.phase).toBe('duel');
    expect(moved.state.duel?.left.unitId).toBe('p1-1');
    expect(moved.state.duel?.right.unitId).toBe('p2-1');

    const finished = finishDuel(moved.state, drawResult(moved.state));
    expect(finished.state.phase).toBe('duel');
    expect(finished.state.duel?.left.unitId).toBe('p1-2');
    expect(finished.state.duel?.right.unitId).toBe('p2-2');
  });
});
