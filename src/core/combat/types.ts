import type { PlayerId } from '../types';

export type FighterMode = 'idle' | 'windup' | 'strike' | 'recover' | 'block' | 'dash' | 'hurt' | 'ko';

export interface FighterState {
  unitId: string;
  owner: PlayerId;
  /** 水平位置（脚底中心）。 */
  x: number;
  /** 垂直位置（脚底），地面为 groundY，站台为台面 y。 */
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  hp: number;
  maxHp: number;
  stamina: number;
  damage: number;
  reduction: number;
  mode: FighterMode;
  modeTimer: number;
  attackCooldown: number;
  dashCooldown: number;
  invuln: number;
  blocking: boolean;
  hitFlash: number;
  dashDir: 1 | -1;
  /** 离开地面后的宽容起跳时间。 */
  coyote: number;
  /** 提前按跳的缓冲。 */
  jumpBuffer: number;
  /** 副手是否装备盾牌。 */
  shield: boolean;
  /** 完美格挡判定窗口（按下格挡后开始倒计时）。 */
  parryTimer: number;
  /** 完美格挡冷却，防止连点刷。 */
  parryCooldown: number;
}

/** 给 UI 的只读快照。 */
export interface FighterView {
  unitId: string;
  owner: PlayerId;
  x: number;
  y: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  stamina: number;
  mode: FighterMode;
  blocking: boolean;
  invulnerable: boolean;
  onGround: boolean;
  hitFlash: number;
  shield: boolean;
  /** 当前处于完美格挡窗口内（HUD 用来亮提示）。 */
  parryReady: boolean;
}

export type AiIntent = 'approach' | 'retreat' | 'attack' | 'block' | 'dash' | 'jump';

/** 单帧操作意图。attack/dash/jump 由模拟器做上升沿检测，按住只触发一次。 */
export interface DuelInput {
  left: boolean;
  right: boolean;
  attack: boolean;
  block: boolean;
  dash: boolean;
  jump: boolean;
  /** 瞄准点（世界坐标 x）：决定朝向，null 表示自动面向对手。 */
  aimX: number | null;
}

export const NO_INPUT: DuelInput = {
  left: false,
  right: false,
  attack: false,
  block: false,
  dash: false,
  jump: false,
  aimX: null,
};
