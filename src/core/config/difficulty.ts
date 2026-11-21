/**
 * 三档难度：同时作用于决斗 AI 与电脑的地图策略。
 * 玩家默认「普通」——明显弱于第一版那个不会失误的对手。
 */

export type DifficultyId = 'easy' | 'normal' | 'hard';

export interface DuelAiProfile {
  /** 决策间隔：越大反应越慢。 */
  reactionSec: number;
  /** 对手起手时选择格挡的概率。 */
  blockChance: number;
  /** 对手起手时选择冲刺闪避的概率。 */
  dashChance: number;
  /** 对手起手时选择跳跃闪避的概率。 */
  jumpChance: number;
  /** 有盾时尝试完美格挡（盾反）的概率。 */
  parrySkill: number;
  /** 主动进攻的倾向（0~1）。 */
  aggression: number;
  /** 造成的伤害倍率。 */
  damageScale: number;
  /** 是否会跳上高台追击。 */
  jumpToPlatforms: boolean;
  /** 血量低于该比例转保守。 */
  lowHpRatio: number;
}

export interface MapAiProfile {
  /** 有资源时优先孵化的倾向（0~1，越大越爱扩张）。 */
  expandChance: number;
  /** 采集评分阈值：越大越"挑食"，只挖最缺的。 */
  greedy: number;
  /** 决策步长（越小越像多线程操作）。 */
  paceMs: number;
}

export interface Difficulty {
  id: DifficultyId;
  label: string;
  desc: string;
  duel: DuelAiProfile;
  map: MapAiProfile;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    label: '简单',
    desc: '反应慢、很少格挡、不会跳台，可以放心练手。',
    duel: {
      reactionSec: 0.34,
      blockChance: 0.1,
      dashChance: 0.04,
      jumpChance: 0.05,
      parrySkill: 0,
      aggression: 0.4,
      damageScale: 0.75,
      jumpToPlatforms: false,
      lowHpRatio: 0.3,
    },
    map: {
      expandChance: 0.15,
      greedy: 0.5,
      paceMs: 620,
    },
  },
  normal: {
    id: 'normal',
    label: '普通',
    desc: '会格挡、会偶尔跳台，正常对局强度。',
    duel: {
      reactionSec: 0.2,
      blockChance: 0.28,
      dashChance: 0.12,
      jumpChance: 0.15,
      parrySkill: 0.12,
      aggression: 0.6,
      damageScale: 0.95,
      jumpToPlatforms: true,
      lowHpRatio: 0.35,
    },
    map: {
      expandChance: 0.5,
      greedy: 0.7,
      paceMs: 420,
    },
  },
  hard: {
    id: 'hard',
    label: '困难',
    desc: '反应快、会盾反、会抢高台，认真打才有的打。',
    duel: {
      reactionSec: 0.11,
      blockChance: 0.45,
      dashChance: 0.22,
      jumpChance: 0.28,
      parrySkill: 0.4,
      aggression: 0.82,
      damageScale: 1.1,
      jumpToPlatforms: true,
      lowHpRatio: 0.4,
    },
    map: {
      expandChance: 0.8,
      greedy: 0.9,
      paceMs: 300,
    },
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard'];

export function difficultyOf(id: DifficultyId): Difficulty {
  return DIFFICULTIES[id];
}
