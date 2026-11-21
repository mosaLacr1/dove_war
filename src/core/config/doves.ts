import type { ItemId } from '../types';

/**
 * 新斑鸠不是 Minecraft 原版物品，使用独立的自定义配方。
 * 门槛是「道具」而不是材料：孵化时消耗指定工具，不需要任何原料。
 */
export interface DoveTier {
  /** 1 起。 */
  tier: number;
  label: string;
  /** 必须持有且在孵化时被消耗的道具。 */
  consumes: ItemId[];
  /** UI 上的背景说明。 */
  note: string;
}

export const DOVE_TIERS: DoveTier[] = [
  {
    tier: 1,
    label: '第一只新斑鸠',
    consumes: ['crafting_table'],
    note: '只消耗 1 个工作台，不需要材料。',
  },
  {
    tier: 2,
    label: '第二只新斑鸠',
    consumes: ['crafting_table', 'stone_pickaxe'],
    note: '只消耗工作台与石镐，不需要材料。',
  },
  {
    tier: 3,
    label: '第三只新斑鸠',
    consumes: ['crafting_table', 'iron_sword'],
    note: '只消耗工作台与铁剑，不需要材料。',
  },
];

export function doveTierFor(made: number): DoveTier | null {
  return DOVE_TIERS[made] ?? null;
}
