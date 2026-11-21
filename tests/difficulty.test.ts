import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { DuelSim } from '../src/core/combat/duel';
import { NO_INPUT, type DuelInput, type FighterView } from '../src/core/combat/types';
import { difficultyOf, DIFFICULTY_ORDER, type DifficultyId } from '../src/core/config/difficulty';
import type { DuelFighterInit } from '../src/core/types';

const DT = BALANCE.duel.tickSec;
const REACH = BALANCE.duel.attack.reach;

function fighter(unitId: string, damage: number): DuelFighterInit {
  return { owner: 0, unitId, damage, reduction: 0, maxHp: BALANCE.baseHp, shield: false };
}

/**
 * 一个"会看距离、会格挡、会贴脸输出"的普通玩家策略：
 * 用来验证三档难度都打得赢，而不是只有数值堆叠。
 */
function policy(self: FighterView, foe: FighterView, tick: number): DuelInput {
  const dx = foe.x - self.x;
  const dist = Math.abs(dx);
  const dy = Math.abs(foe.y - self.y);
  const base: DuelInput = { ...NO_INPUT, aimX: foe.x };

  // 对手起手且在范围内：格挡
  if (foe.mode === 'windup' && dist < REACH + 20 && dy < BALANCE.duel.attack.verticalReach) {
    return { ...base, block: true };
  }
  // 明显高低差：跳上去
  if (dy > BALANCE.duel.attack.verticalReach && self.onGround) {
    return { ...base, jump: true, left: dx < 0, right: dx > 0 };
  }
  if (dist > REACH - 10) {
    return { ...base, left: dx < 0, right: dx > 0 };
  }
  // 贴脸：每 5 帧给一次攻击上升沿（模拟器自带 0.46s 冷却）
  return { ...base, attack: tick % 5 === 0 };
}

function runDuel(id: DifficultyId): { won: boolean; playerHp: number; aiHp: number } {
  const sim = new DuelSim({
    seed: 'DIFFICULTY-SIM',
    left: fighter('player', BALANCE.duel.attack.baseDamage + 6),
    right: fighter('ai', BALANCE.duel.attack.baseDamage + 6),
    aiSides: ['right'],
    aiProfile: difficultyOf(id).duel,
    durationSec: 60,
  });

  for (let i = 0; i < 60 * 70 && !sim.finished; i += 1) {
    const [left, right] = sim.getSnapshot().fighters;
    sim.step(DT, policy(left, right, i));
  }

  const result = sim.finalResult;
  return {
    won: result?.winnerUnitId === 'player',
    playerHp: result?.leftHp ?? 0,
    aiHp: result?.rightHp ?? 0,
  };
}

describe('难度梯度', () => {
  it('三档难度都能被打赢（会格挡 + 会贴脸输出的普通打法）', () => {
    for (const id of DIFFICULTY_ORDER) {
      const outcome = runDuel(id);
      expect(outcome.won, `${id} 难度下普通打法无法获胜`).toBe(true);
    }
  });

  it('难度越高，玩家付出的代价越大', () => {
    const easy = runDuel('easy');
    const hard = runDuel('hard');
    expect(easy.playerHp).toBeGreaterThan(hard.playerHp);
  });

  it('简单难度会留出明显余量，不至于一上手就被打崩', () => {
    const easy = runDuel('easy');
    expect(easy.playerHp).toBeGreaterThan(BALANCE.baseHp * 0.4);
  });
});
