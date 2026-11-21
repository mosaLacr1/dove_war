import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { ITEMS } from '../src/core/config/items';
import { DuelSim } from '../src/core/combat/duel';
import { NO_INPUT, type DuelInput } from '../src/core/combat/types';
import type { DuelFighterInit, DuelResult, PlayerId } from '../src/core/types';

const GROUND: number = BALANCE.duel.arena.groundY;

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

function runUntilDone(sim: DuelSim, source: (tick: number) => DuelInput, maxTicks = 60 * 70): number {
  let ticks = 0;
  while (!sim.finished && ticks < maxTicks) {
    sim.step(BALANCE.duel.tickSec, source(ticks));
    ticks += 1;
  }
  return ticks;
}

describe('决斗计时与结算', () => {
  it('60 秒内无人操作时按血量判平局', () => {
    const sim = new DuelSim({ seed: 'DRAW-1', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [], durationSec: 1 });
    const ticks = runUntilDone(sim, () => NO_INPUT, 200);
    expect(ticks).toBeLessThanOrEqual(200);
    const result = sim.finalResult as DuelResult;
    expect(result).not.toBeNull();
    expect(result.kind).toBe('draw');
    expect(result.leftHp).toBe(result.rightHp);
  });

  it('时间耗尽时血量更高的一方获胜', () => {
    // 双方都不出手，仅靠初始血量差触发「比血量」分支
    const sim = new DuelSim({
      seed: 'TIME-0',
      left: fighter(0, 'a', 5, 0, 150),
      right: fighter(1, 'b', 5, 0, 100),
      aiSides: [],
      durationSec: 1,
    });
    runUntilDone(sim, () => NO_INPUT, 200);
    const result = sim.finalResult as DuelResult;
    expect(result.kind).toBe('timeout');
    expect(result.winnerUnitId).toBe('a');
    expect(result.leftHp).toBeGreaterThan(result.rightHp);
  });

  it('双方交战后由更高输出的一方取胜', () => {
    const sim = new DuelSim({
      seed: 'TIME-1',
      left: fighter(0, 'a', 20),
      right: fighter(1, 'b', 5),
      aiSides: ['right'],
      durationSec: 10,
    });
    // 先接近，再按冷却节奏出手
    runUntilDone(sim, (i) => input({ right: i < 100, attack: i >= 100 && i % 34 === 0 }));
    const result = sim.finalResult as DuelResult;
    expect(result).not.toBeNull();
    expect(result.winnerUnitId).toBe('a');
    expect(['ko', 'timeout']).toContain(result.kind);
  });

  it('击倒对手立即结束决斗', () => {
    const sim = new DuelSim({
      seed: 'KO-1',
      left: fighter(0, 'a', 400),
      right: fighter(1, 'b', 5),
      aiSides: ['right'],
    });
    runUntilDone(sim, (i) => input({ right: true, attack: i % 8 === 0 }), 60 * 20);
    const result = sim.finalResult as DuelResult;
    expect(result.kind).toBe('ko');
    expect(result.winnerUnitId).toBe('a');
    expect(result.loserUnitId).toBe('b');
    expect(result.rightHp).toBe(0);
  });

  it('倒计时单调递减且不会为负', () => {
    const sim = new DuelSim({ seed: 'CLOCK', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    let previous = sim.timeLeft;
    for (let i = 0; i < 120; i += 1) {
      sim.step(BALANCE.duel.tickSec, NO_INPUT);
      expect(sim.timeLeft).toBeLessThanOrEqual(previous + 1e-9);
      previous = sim.timeLeft;
    }
    expect(sim.timeLeft).toBeGreaterThan(0);
  });
});

describe('跳跃与地形', () => {
  it('按住跳跃键会离地并升到平台之上', () => {
    const sim = new DuelSim({ seed: 'JUMP-1', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    let apex = GROUND;
    for (let i = 0; i < 24; i += 1) {
      sim.step(BALANCE.duel.tickSec, input({ jump: true }));
      apex = Math.min(apex, sim.getSnapshot().fighters[0].y);
    }
    expect(apex).toBeLessThan(GROUND - 90);
  });

  it('跳到平台上会站稳，而不是穿下去', () => {
    const sim = new DuelSim({ seed: 'JUMP-2', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    for (let i = 0; i < 20; i += 1) sim.step(BALANCE.duel.tickSec, input({ jump: true }));
    for (let i = 0; i < 120; i += 1) {
      sim.step(BALANCE.duel.tickSec, NO_INPUT);
      const f = sim.getSnapshot().fighters[0];
      if (f.onGround) break;
    }
    const settled = sim.getSnapshot().fighters[0];
    expect(settled.onGround).toBe(true);
    expect(settled.y).toBe(BALANCE.duel.platforms[0]?.y);
  });

  it('轻点小跳明显低于按住高跳（可变跳跃高度）', () => {
    const apexFor = (holdTicks: number): number => {
      const sim = new DuelSim({ seed: 'JUMP-3', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
      let apex = GROUND;
      for (let i = 0; i < 90; i += 1) {
        sim.step(BALANCE.duel.tickSec, i < holdTicks ? input({ jump: true }) : NO_INPUT);
        apex = Math.min(apex, sim.getSnapshot().fighters[0].y);
      }
      return GROUND - apex;
    };
    const tap = apexFor(1);
    const hold = apexFor(20);
    expect(tap).toBeGreaterThan(5);
    expect(tap).toBeLessThan(hold * 0.7);
  });

  it('站在台上走出边缘会掉下去', () => {
    const sim = new DuelSim({ seed: 'JUMP-4', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    // 先跳上左侧平台
    for (let i = 0; i < 20; i += 1) sim.step(BALANCE.duel.tickSec, input({ jump: true, right: true }));
    for (let i = 0; i < 80; i += 1) sim.step(BALANCE.duel.tickSec, NO_INPUT);

    // 一直向右走，掉下平台
    let landedOnGround = false;
    for (let i = 0; i < 240; i += 1) {
      sim.step(BALANCE.duel.tickSec, input({ right: true }));
      const f = sim.getSnapshot().fighters[0];
      if (f.onGround && Math.abs(f.y - GROUND) < 0.5) {
        landedOnGround = true;
        break;
      }
    }
    expect(landedOnGround).toBe(true);
  });
});

describe('打击手感', () => {
  it('命中会有顿帧：命中后模拟短暂冻结', () => {
    const sim = new DuelSim({
      seed: 'HITSTOP',
      left: fighter(0, 'a', 20),
      right: fighter(1, 'b', 5),
      aiSides: ['right'],
    });
    let previousHp = sim.getSnapshot().fighters[1].hp;
    let hit = false;
    for (let i = 0; i < 900 && !hit; i += 1) {
      sim.step(BALANCE.duel.tickSec, input({ right: true, attack: i % 20 === 0 }));
      const hp = sim.getSnapshot().fighters[1].hp;
      if (hp < previousHp) hit = true;
      previousHp = hp;
    }
    expect(hit).toBe(true);

    const before = sim.getSnapshot().elapsed;
    sim.step(BALANCE.duel.tickSec, NO_INPUT);
    expect(sim.getSnapshot().elapsed).toBeCloseTo(before, 6);
    expect(sim.getSnapshot().shake).toBeGreaterThan(0);
  });
});

describe('确定性', () => {
  it('同种子 + 同输入序列产生完全相同的战斗过程', () => {
    const script = (tick: number): DuelInput =>
      input({
        right: tick % 37 < 18,
        attack: tick % 23 === 0,
        block: tick % 91 < 8,
        dash: tick % 53 === 0,
        jump: tick % 41 === 0,
      });

    const run = (): { result: DuelResult | null; hp: [number, number]; ticks: number; y: number } => {
      const sim = new DuelSim({
        seed: 'REPLAY-42',
        left: fighter(0, 'a', 9),
        right: fighter(1, 'b', 8),
        aiSides: ['right'],
      });
      const ticks = runUntilDone(sim, script, 60 * 65);
      const snap = sim.getSnapshot();
      return { result: sim.finalResult, hp: [snap.fighters[0].hp, snap.fighters[1].hp], ticks, y: snap.fighters[0].y };
    };

    const first = run();
    const second = run();
    expect(second.ticks).toBe(first.ticks);
    expect(second.hp).toEqual(first.hp);
    expect(second.y).toBe(first.y);
    expect(second.result).toEqual(first.result);
  });

  it('不同种子在同一输入下会产生不同过程', () => {
    const run = (seed: string): number => {
      const sim = new DuelSim({ seed, left: fighter(0, 'a', 9), right: fighter(1, 'b', 8), aiSides: ['right'] });
      runUntilDone(sim, (i) => input({ right: true, attack: i % 20 === 0 }), 60 * 30);
      return sim.getSnapshot().fighters[1].hp;
    };
    const values = new Set([run('S-A'), run('S-B'), run('S-C')]);
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('平衡边界', () => {
  it('最强武器也无法在一击内击倒对手', () => {
    const maxDamage = BALANCE.duel.attack.baseDamage + (ITEMS.diamond_sword.attackBonus ?? 0);
    expect(maxDamage).toBeLessThan(BALANCE.baseHp);
  });

  it('理论最快击杀时间大于 4 秒（避免无交互速杀）', () => {
    const maxDamage = BALANCE.duel.attack.baseDamage + (ITEMS.diamond_sword.attackBonus ?? 0);
    const hitsNeeded = Math.ceil(BALANCE.baseHp / maxDamage);
    const minKillSeconds = hitsNeeded * BALANCE.duel.attack.cooldownSec;
    expect(minKillSeconds).toBeGreaterThan(4);
  });

  it('四件铁甲减伤不超过 35%，不会变成无敌', () => {
    const reduction = 1 - (1 - 0.05) * (1 - 0.1) * (1 - 0.08) * (1 - 0.04);
    expect(reduction).toBeGreaterThan(0.2);
    expect(reduction).toBeLessThan(0.35);
  });

  it('一次完整决斗接近 60 秒上限且时间栏不越界', () => {
    const sim = new DuelSim({ seed: 'FULL', left: fighter(0, 'a'), right: fighter(1, 'b'), aiSides: [] });
    runUntilDone(sim, () => NO_INPUT, 60 * 70);
    expect(sim.finished).toBe(true);
    expect(sim.timeLeft).toBe(0);
  });
});
