import { describe, expect, it } from 'vitest';
import { planAiStep } from '../src/core/ai/mapAi';
import { aiTurnStep, createGame, endTurn } from '../src/core/game';
import type { GameState } from '../src/core/types';

describe('开局状态', () => {
  it('双方各 1 只斑鸠、空库存、玩家 1 先手', () => {
    const state = createGame('START-1');
    expect(state.units.filter((u) => u.alive)).toHaveLength(2);
    expect(state.units.filter((u) => u.owner === 0)).toHaveLength(1);
    expect(state.units.filter((u) => u.owner === 1)).toHaveLength(1);
    expect(state.players[0].inventory).toEqual({});
    expect(state.currentPlayer).toBe(0);
    expect(state.round).toBe(1);
    expect(state.phase).toBe('map');
    expect(state.map.valid).toBe(true);
    expect(state.winner).toBeNull();
  });

  it('同种子重开会重建完全一致的初始局面', () => {
    const a = createGame('RESTART');
    const b = createGame('RESTART');
    expect(a.map.tiles).toEqual(b.map.tiles);
    expect(a.units.map((u) => [u.owner, u.x, u.y, u.actionsLeft])).toEqual(
      b.units.map((u) => [u.owner, u.x, u.y, u.actionsLeft]),
    );
    expect(a.round).toBe(b.round);
  });
});

describe('电脑对手', () => {
  it('不在自己回合时不会产生计划', () => {
    const state = createGame('AI-0');
    expect(planAiStep(state)).toBeNull();
  });

  it('能在自己的回合自主采集并交出回合', () => {
    let state: GameState = createGame('AI-1');
    state.currentPlayer = 1;

    let steps = 0;
    while (state.phase === 'map' && state.currentPlayer === 1 && steps < 80) {
      const step = aiTurnStep(state);
      expect(step).not.toBeNull();
      if (!step) break;
      state = step.state;
      steps += 1;
    }

    expect(steps).toBeGreaterThan(0);
    expect(state.currentPlayer).toBe(0);
    const material = (state.players[1].inventory.log ?? 0) + (state.players[1].inventory.planks ?? 0);
    expect(material).toBeGreaterThan(0);
  });

  it('连续多个回合后电脑仍在正常推进（不会卡死）', () => {
    let state: GameState = createGame('AI-2');
    for (let round = 0; round < 6; round += 1) {
      if (state.phase !== 'map') break;
      // 玩家 1 直接结束回合
      state = endTurn(state).state;
      let steps = 0;
      while (state.phase === 'map' && state.currentPlayer === 1 && steps < 80) {
        const step = aiTurnStep(state);
        if (!step) break;
        state = step.state;
        steps += 1;
      }
      expect(steps).toBeLessThan(80);
    }
    expect(state.phase === 'map' || state.phase === 'duel' || state.phase === 'over').toBe(true);
    expect(state.round).toBeGreaterThan(1);
  });
});
