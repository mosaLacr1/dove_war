/** 全部可调数值集中在这里，避免散落在逻辑与 UI 中。 */

export interface PlatformDef {
  x1: number;
  x2: number;
  /** 台面高度（角色脚底所在的 y）。 */
  y: number;
}

export const BALANCE = {
  /** 地图固定 10 行 × 16 列。 */
  map: {
    width: 16,
    height: 10,
    /** 校验：出生点曼哈顿距离 ≤ woodRadius 内至少要 woodCount 块木头。 */
    woodRadius: 2,
    woodCount: 4,
    /** 校验：出生点曼哈顿距离 ≤ stoneRadius 内至少要 stoneCount 块石头。 */
    stoneRadius: 3,
    stoneCount: 8,
    /** 校验：最近的生铁块距出生点最多 ironMaxDist 步。 */
    ironMaxDist: 10,
    /** 生成失败最多重试次数。 */
    maxAttempts: 50,
    /** 出生点：左方玩家 (1,4)，右方镜像 (14,4)。 */
    spawn: [
      { x: 1, y: 4 },
      { x: 14, y: 4 },
    ] as const,
    /** 单侧配额：保证每侧都够用，整体资源比上一版更富裕。 */
    quotas: {
      wood: 5,
      stone: 10,
      raw_iron_block: 4,
      gold_block: 3,
      diamond: 3,
    },
    /** 额外随机填充的比例（在配额之外再撒一些资源）。 */
    fillChance: {
      stone: 0.16,
      wood: 0.12,
      raw_iron_block: 0.03,
    },
  },

  /** 每只斑鸠每回合的行动次数（玩家不共享）。 */
  actionsPerDove: 2,

  /** 斑鸠基础生命值，同时是决斗开场血量。 */
  baseHp: 150,

  /** 新斑鸠数量上限（不含开局赠送的那一只）。 */
  doveLimit: 3,

  duel: {
    durationSec: 60,
    tickSec: 1 / 60,
    arena: { width: 960, height: 540, groundY: 470, minX: 44, maxX: 916 },
    startX: { left: 210, right: 750 },
    bodyHalfWidth: 20,

    /** 决斗场地的高低台（单向平台）：三层结构，靠跳跃争夺制高点。 */
    platforms: [
      { x1: 96, x2: 300, y: 356 },
      { x1: 660, x2: 864, y: 356 },
      { x1: 396, x2: 564, y: 274 },
    ] as PlatformDef[],

    physics: {
      gravity: 2450,
      jumpVelocity: -800,
      maxFallSpeed: 1500,
      groundSpeed: 230,
      airSpeed: 205,
      blockSpeed: 92,
      accel: 3200,
      airAccel: 2200,
      friction: 3000,
      coyoteSec: 0.09,
      jumpBufferSec: 0.12,
    },

    attack: {
      /** 前摇：留出可被完美格挡的反应窗口，同时保持出手利落。 */
      windupSec: 0.14,
      strikeSec: 0.07,
      recoverSec: 0.26,
      cooldownSec: 0.46,
      reach: 84,
      verticalReach: 62,
      baseDamage: 5,
    },

    block: {
      /** 空手/无盾格挡的伤害倍率。 */
      damageMultiplier: 0.3,
      /** 举盾（副手装备盾牌）时的伤害倍率，更强。 */
      shieldMultiplier: 0.2,
      staminaDrainPerSec: 16,
      staminaHitCost: 12,
      guardBreakSec: 0.4,
    },

    /** 完美格挡 / 盾反。 */
    parry: {
      /** 按下格挡后的判定窗口：比前摇短，必须贴脸时按下才算完美。 */
      windowSec: 0.08,
      /** 触发一次完美格挡后的冷却，防止连点刷。 */
      cooldownSec: 0.8,
      /** 空手完美格挡让对手硬直的时间。 */
      stunSec: 0.45,
      /** 有盾时盾反让对手硬直的时间。 */
      shieldStunSec: 0.6,
      /** 盾反反弹的伤害比例。 */
      reflectRatio: 0.35,
      /** 完美格挡回复的耐力。 */
      staminaGain: 15,
      /** 盾反击退速度。 */
      knockback: 150,
    },

    stamina: {
      max: 100,
      regenPerSec: 18,
    },

    dash: {
      speed: 560,
      durationSec: 0.16,
      cooldownSec: 2.2,
      staminaCost: 28,
    },

    hurt: {
      durationSec: 0.16,
      knockback: 82,
    },

    /** 命中瞬间的顿帧，让打击更"实"。 */
    hitStopSec: 0.055,
    /** 命中时的镜头抖动强度（像素）。 */
    shakeOnHit: 7,
    /** 盾反时更强烈的抖动。 */
    shakeOnParry: 11,
    shakeDecayPerSec: 42,

    /** 血量低于该比例时 AI 转为保守。 */
    aiLowHpRatio: 0.35,

    /** 双击同方向键触发冲刺的时间窗。 */
    doubleTapSec: 0.28,
  },
} as const;

export type Balance = typeof BALANCE;
