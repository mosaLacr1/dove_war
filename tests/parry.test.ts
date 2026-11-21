import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { DuelSim } from '../src/core/combat/duel';
import { NO_INPUT, type DuelInput } from '../src/core/combat/types';
import { createGame, moveUnit } from '../src/core/game';
import type { DuelFighterInit, PlayerId } from '../src/core/types';

const DT = BALANCE.duel.tickSec;
const ATTACK_TICKS_TO_STRIKE = Math.ceil(BALANCE.duel.attack.windupSec / DT) + 1;

function fighter(
  owner: PlayerId,
  unitId: string,
  damage = 5,
  reduction = 0,
  maxHp: number = BALANCE.baseHp,
  shield = false,
): DuelFighterInit {
  return { owner, unitId, damage, reduction, maxHp, shield };
}

function input(over: Partial<DuelInput> = {}): DuelInput {
  return { ...NO_INPUT, ...over };
}

/** 让双方靠近到攻击距离内。 */
function approach(sim: DuelSim): void {
  for (let i = 0; i < 900; i += 1) {
    const [l, r] = sim.getSnapshot().fighters;
    if (Math.abs(l.x - r.x) <= 60) return;
    sim.stepBoth(DT, input({ right: l.x < r.x }), input({ left: l.x < r.x }));
  }
  throw new Error('双方未能靠近');
}

/**
 * 右方起手攻击，左方在指定 tick 按下格挡（用于控制完美格挡的时机）。
 * blockAtTick 为 null 表示不格挡。
 */
function exchange(sim: DuelSim, blockAtTick: number | null): void {
  sim.stepBoth(DT, NO_INPUT, input({ attack: true }));
  for (let i = 1; i <= ATTACK_TICKS_TO_STRIKE + 2; i += 1) {
    const left = blockAtTick !== null && i >= blockAtTick ? input({ block: true }) : NO_INPUT;
    sim.stepBoth(DT, left, NO_INPUT);
  }
}

describe('完美格挡与盾反', () => {
  it('在命中前一瞬按下格挡 = 完美格挡：不掉血，且攻击者被弹硬直', () => {
    const sim = new DuelSim({ seed: 'PARRY-1', left: fighter(0, 'a', 5), right: fighter(1, 'b', 20), aiSides: [] });
    approach(sim);
    exchange(sim, ATTACK_TICKS_TO_STRIKE - 1);

    const [left, right] = sim.getSnapshot().fighters;
    expect(left.hp).toBe(BALANCE.baseHp);
    expect(right.mode).toBe('hurt');
    expect(sim.getSnapshot().effects.some((e) => e.kind === 'parry')).toBe(true);
  });

  it('过早按下格挡只是普通格挡：仍然掉血', () => {
    const sim = new DuelSim({ seed: 'PARRY-2', left: fighter(0, 'a', 5), right: fighter(1, 'b', 20), aiSides: [] });
    approach(sim);
    exchange(sim, 1);

    const [left] = sim.getSnapshot().fighters;
    const expected = BALANCE.baseHp - 20 * BALANCE.duel.block.damageMultiplier;
    expect(left.hp).toBeCloseTo(expected, 5);
  });

  it('副手有盾时完美格挡触发盾反：把伤害弹回去', () => {
    const sim = new DuelSim({
      seed: 'PARRY-3',
      left: fighter(0, 'a', 5, 0, BALANCE.baseHp, true),
      right: fighter(1, 'b', 20),
      aiSides: [],
    });
    approach(sim);
    exchange(sim, ATTACK_TICKS_TO_STRIKE - 1);

    const [left, right] = sim.getSnapshot().fighters;
    expect(left.hp).toBe(BALANCE.baseHp);
    expect(right.hp).toBeCloseTo(BALANCE.baseHp - 20 * BALANCE.duel.parry.reflectRatio, 5);
    expect(right.mode).toBe('hurt');
    expect(sim.getSnapshot().effects.some((e) => e.kind === 'counter')).toBe(true);
  });

  it('有盾的普通格挡比空手更硬', () => {
    const withShield = new DuelSim({
      seed: 'PARRY-4',
      left: fighter(0, 'a', 5, 0, BALANCE.baseHp, true),
      right: fighter(1, 'b', 20),
      aiSides: [],
    });
    approach(withShield);
    exchange(withShield, 1);
    const [blocked] = withShield.getSnapshot().fighters;
    const expected = BALANCE.baseHp - 20 * BALANCE.duel.block.shieldMultiplier;
    expect(blocked.hp).toBeCloseTo(expected, 5);
  });

  it('完美格挡窗口很短：按住不放不会一直处于窗口内', () => {
    const sim = new DuelSim({ seed: 'PARRY-5', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    for (let i = 0; i < 4; i += 1) sim.stepBoth(DT, NO_INPUT, NO_INPUT);
    sim.stepBoth(DT, input({ block: true }), NO_INPUT);
    expect(sim.getSnapshot().fighters[0].parryReady).toBe(true);
    for (let i = 0; i < 20; i += 1) sim.stepBoth(DT, input({ block: true }), NO_INPUT);
    expect(sim.getSnapshot().fighters[0].parryReady).toBe(false);
  });

  it('完美格挡成功后进入冷却，短时间内再按不会重新点亮窗口', () => {
    const sim = new DuelSim({
      seed: 'PARRY-6',
      left: fighter(0, 'a'),
      right: fighter(1, 'b', 20),
      aiSides: [],
    });
    approach(sim);
    exchange(sim, ATTACK_TICKS_TO_STRIKE - 1);
    expect(sim.getSnapshot().effects.some((e) => e.kind === 'parry')).toBe(true);

    // 冷却 0.8s：0.2s 后再按格挡不应重新点亮
    for (let i = 0; i < 12; i += 1) sim.stepBoth(DT, NO_INPUT, NO_INPUT);
    sim.stepBoth(DT, input({ block: true }), NO_INPUT);
    expect(sim.getSnapshot().fighters[0].parryReady).toBe(false);
  });
});

describe('朝向与鼠标', () => {
  it('aimX 决定朝向：鼠标在左就朝左，在右就朝右', () => {
    const sim = new DuelSim({ seed: 'AIM-1', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    const x = sim.getSnapshot().fighters[0].x;
    sim.stepBoth(DT, input({ aimX: x - 200 }), NO_INPUT);
    expect(sim.getSnapshot().fighters[0].facing).toBe(-1);
    sim.stepBoth(DT, input({ aimX: x + 200 }), NO_INPUT);
    expect(sim.getSnapshot().fighters[0].facing).toBe(1);
  });

  it('背对对手出手会打空（出手方向由鼠标决定）', () => {
    const sim = new DuelSim({
      seed: 'AIM-2',
      left: fighter(0, 'a', 20),
      right: fighter(1, 'b', 5),
      aiSides: [],
    });
    approach(sim);
    const leftX = sim.getSnapshot().fighters[0].x;
    const rightX = sim.getSnapshot().fighters[1].x;
    const away = rightX > leftX ? leftX - 200 : leftX + 200;
    sim.stepBoth(DT, input({ aimX: away, attack: true }), NO_INPUT);
    for (let i = 0; i < 6; i += 1) sim.stepBoth(DT, input({ aimX: away }), NO_INPUT);
    expect(sim.getSnapshot().fighters[1].hp).toBe(BALANCE.baseHp);
  });

  it('不提供 aimX 时自动面向对手', () => {
    const sim = new DuelSim({ seed: 'AIM-3', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    sim.stepBoth(DT, NO_INPUT, NO_INPUT);
    expect(sim.getSnapshot().fighters[0].facing).toBe(1);
    expect(sim.getSnapshot().fighters[1].facing).toBe(-1);
  });
});

describe('难度', () => {
  it('难度会写入局面，并影响电脑在决斗中的伤害', () => {
    const S = BALANCE.map.spawn[0];
    const trigger = (game: ReturnType<typeof createGame>) => {
      const enemy = game.units.find((u) => u.owner === 1);
      if (!enemy) throw new Error('缺少电脑斑鸠');
      enemy.x = S.x + 1;
      enemy.y = S.y + 1;
      const moved = moveUnit(game, 'p1-1', { x: S.x, y: S.y + 1 });
      if (!moved.state.duel) throw new Error('没有进入决斗');
      return moved.state.duel;
    };

    const easy = trigger(createGame('DIFF', 'easy'));
    const normal = trigger(createGame('DIFF', 'normal'));
    const hard = trigger(createGame('DIFF', 'hard'));

    expect(createGame('DIFF', 'easy').difficulty).toBe('easy');
    expect(easy.right.damage).toBeLessThan(normal.right.damage);
    expect(normal.right.damage).toBeLessThan(hard.right.damage);
    // 玩家一侧的伤害不受难度影响
    expect(easy.left.damage).toBe(normal.left.damage);
  });
});
