/** 全局数据模型。本文件不依赖任何其他模块，避免循环引用。 */

import type { DifficultyId } from './config/difficulty';

export type PlayerId = 0 | 1;

/** 地图上的资源种类。挖掘产物见 config/resources.ts。 */
export type ResourceKind = 'wood' | 'stone' | 'raw_iron_block' | 'gold_block' | 'diamond';

export type TileKind = 'empty' | ResourceKind;

/**
 * 物品 ID。命名与 Minecraft 1.20.4 对齐：
 * - `raw_iron` = 生铁（原版粗铁），`iron_ingot` = 铁锭，`raw_iron_block` = 生铁块（本项目自定义）
 * - `cobblestone` = 圆石，`stone` = 石头
 * - 刻意不提供原版 `iron_block`（铁块），避免与「生铁块」混淆。
 */
export type ItemId =
  | 'log'
  | 'planks'
  | 'stick'
  | 'crafting_table'
  | 'cobblestone'
  | 'stone'
  | 'furnace'
  | 'raw_iron'
  | 'raw_iron_block'
  | 'iron_ingot'
  | 'gold_block'
  | 'gold_ingot'
  | 'diamond'
  | 'wooden_pickaxe'
  | 'stone_pickaxe'
  | 'iron_pickaxe'
  | 'wooden_sword'
  | 'stone_sword'
  | 'iron_sword'
  | 'diamond_sword'
  | 'iron_helmet'
  | 'iron_chestplate'
  | 'iron_leggings'
  | 'iron_boots'
  | 'shield';

export type GearSlot = 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'feet';

export interface Coord {
  x: number;
  y: number;
}

export interface GameMap {
  width: number;
  height: number;
  /** 行优先展开，索引 = y * width + x。 */
  tiles: TileKind[];
  seed: string;
  /** 生成时使用的重试次数，0 表示一次成功。 */
  attempts: number;
  /** 是否通过全部公平性/连通性校验。 */
  valid: boolean;
}

export interface Equipment {
  weapon: ItemId | null;
  /** 副手：目前只有盾牌。 */
  offhand: ItemId | null;
  head: ItemId | null;
  chest: ItemId | null;
  legs: ItemId | null;
  feet: ItemId | null;
}

export interface Unit {
  id: string;
  owner: PlayerId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** 本回合剩余行动次数。 */
  actionsLeft: number;
  /** 出生时的回合数，用于「新斑鸠下一回合才能行动」。 */
  spawnRound: number;
  equipment: Equipment;
  alive: boolean;
}

export type Inventory = Partial<Record<ItemId, number>>;

export interface PlayerState {
  id: PlayerId;
  name: string;
  /** 玩家共享库存，不属于某一只斑鸠。 */
  inventory: Inventory;
  /** 熔炉燃料点：木板 3 点、木棍 1 点、原木 3 点，每次熔炼消耗 2 点。 */
  furnaceFuel: number;
  /** 已合成的新斑鸠数量，决定阶梯门槛。 */
  dovesMade: number;
}

export interface DuelFighterInit {
  unitId: string;
  owner: PlayerId;
  damage: number;
  reduction: number;
  maxHp: number;
  /** 副手是否装备盾牌：影响减伤与盾反。 */
  shield: boolean;
}

export interface DuelState {
  left: DuelFighterInit;
  right: DuelFighterInit;
  seed: number;
}

export interface DuelResult {
  /** 'ko' 击倒、'timeout' 时间耗尽、'draw' 平局。 */
  kind: 'ko' | 'timeout' | 'draw';
  winnerUnitId: string | null;
  loserUnitId: string | null;
  leftUnitId: string;
  rightUnitId: string;
  leftHp: number;
  rightHp: number;
  /** 给玩家看的结算文案。 */
  reason: string;
}

export type GamePhase = 'title' | 'map' | 'duel' | 'over';

export interface LogEntry {
  id: number;
  text: string;
  kind: 'info' | 'success' | 'warn' | 'duel';
  round: number;
}

export interface GameState {
  seed: string;
  difficulty: DifficultyId;
  map: GameMap;
  players: [PlayerState, PlayerState];
  units: Unit[];
  round: number;
  currentPlayer: PlayerId;
  phase: GamePhase;
  duel: DuelState | null;
  /** 已记录的交战冷却 pair key，直到双方脱离相邻才清除。 */
  cooldowns: string[];
  winner: PlayerId | 'draw' | null;
  log: LogEntry[];
  nextUnitSeq: number;
  nextLogId: number;
  /** 决斗序号，用于给每场决斗派生互不相同的确定性种子。 */
  duelSeq: number;
}

/** 所有会修改局面的动作都返回它，UI 只负责展示。 */
export interface ActionResult {
  ok: boolean;
  state: GameState;
  /** 失败原因（ok=false 时必有）或成功提示。 */
  message: string;
}
