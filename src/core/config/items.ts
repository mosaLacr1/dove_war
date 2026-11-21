import type { ItemId, ResourceKind } from '../types';

export type ItemCategory = 'material' | 'block' | 'tool' | 'weapon' | 'armor' | 'shield';

export interface ItemDef {
  id: ItemId;
  /** UI 显示的中文名，全项目唯一定义处。 */
  name: string;
  en: string;
  category: ItemCategory;
  stackable: boolean;
  /** 作为熔炉燃料提供的燃料点；每次熔炼消耗 2 点。 */
  fuelPoints?: number;
  /** 镐的等级，用于挖掘门槛比较。 */
  pickaxeTier?: number;
  /** 武器附加伤害（最终伤害 = 基础伤害 + 该值）。 */
  attackBonus?: number;
  /** 护甲单件减伤比例，多件按 (1-r) 连乘。 */
  armorPoints?: number;
  /** 一句话说明，UI tooltip 使用。 */
  hint?: string;
}

const DEFS: ItemDef[] = [
  { id: 'log', name: '原木', en: 'Oak Log', category: 'material', stackable: true, fuelPoints: 3, hint: '空手即可采集，是木制品的起点。' },
  { id: 'planks', name: '木板', en: 'Oak Planks', category: 'material', stackable: true, fuelPoints: 3, hint: '1 原木 → 4 木板。' },
  { id: 'stick', name: '木棍', en: 'Stick', category: 'material', stackable: true, fuelPoints: 1, hint: '工具与武器的握柄。' },
  { id: 'crafting_table', name: '工作台', en: 'Crafting Table', category: 'block', stackable: true, fuelPoints: 3, hint: '3×3 配方需要它；持有即可用，不消耗。' },
  { id: 'cobblestone', name: '圆石', en: 'Cobblestone', category: 'block', stackable: true, hint: '挖掘「石头」资源块的产物。' },
  { id: 'stone', name: '石头', en: 'Stone', category: 'block', stackable: true, hint: '圆石熔炼后得到，用于原版替换配方。' },
  { id: 'furnace', name: '熔炉', en: 'Furnace', category: 'block', stackable: true, hint: '8 圆石围成一圈；熔炼铁锭需要它。' },
  { id: 'raw_iron', name: '生铁', en: 'Raw Iron', category: 'material', stackable: true, hint: '需在熔炉中烧成铁锭，还不是铁锭。' },
  { id: 'raw_iron_block', name: '生铁块', en: 'Block of Raw Iron', category: 'block', stackable: true, hint: '拆解为 9 个生铁；与「铁块」不是一回事。' },
  { id: 'iron_ingot', name: '铁锭', en: 'Iron Ingot', category: 'material', stackable: true, hint: '由生铁熔炼而来。' },
  { id: 'gold_block', name: '金块', en: 'Block of Gold', category: 'block', stackable: true, hint: '拆解为 9 个金锭。' },
  { id: 'gold_ingot', name: '金锭', en: 'Gold Ingot', category: 'material', stackable: true, hint: '装饰与高阶合成材料。' },
  { id: 'diamond', name: '钻石', en: 'Diamond', category: 'material', stackable: true, hint: '最稀有的资源，需要铁镐。' },

  { id: 'wooden_pickaxe', name: '木镐', en: 'Wooden Pickaxe', category: 'tool', stackable: false, pickaxeTier: 1, hint: '可挖石头。' },
  { id: 'stone_pickaxe', name: '石镐', en: 'Stone Pickaxe', category: 'tool', stackable: false, pickaxeTier: 2, hint: '可挖生铁块。' },
  { id: 'iron_pickaxe', name: '铁镐', en: 'Iron Pickaxe', category: 'tool', stackable: false, pickaxeTier: 3, hint: '可挖金块与钻石矿。' },

  { id: 'wooden_sword', name: '木剑', en: 'Wooden Sword', category: 'weapon', stackable: false, attackBonus: 2, hint: '决斗伤害 +2。' },
  { id: 'stone_sword', name: '石剑', en: 'Stone Sword', category: 'weapon', stackable: false, attackBonus: 4, hint: '决斗伤害 +4。' },
  { id: 'iron_sword', name: '铁剑', en: 'Iron Sword', category: 'weapon', stackable: false, attackBonus: 6, hint: '决斗伤害 +6。' },
  { id: 'diamond_sword', name: '钻石剑', en: 'Diamond Sword', category: 'weapon', stackable: false, attackBonus: 8, hint: '决斗伤害 +8。' },

  { id: 'iron_helmet', name: '铁头盔', en: 'Iron Helmet', category: 'armor', stackable: false, armorPoints: 0.05, hint: '减伤 5%。' },
  { id: 'iron_chestplate', name: '铁胸甲', en: 'Iron Chestplate', category: 'armor', stackable: false, armorPoints: 0.1, hint: '减伤 10%。' },
  { id: 'iron_leggings', name: '铁护腿', en: 'Iron Leggings', category: 'armor', stackable: false, armorPoints: 0.08, hint: '减伤 8%。' },
  { id: 'iron_boots', name: '铁靴子', en: 'Iron Boots', category: 'armor', stackable: false, armorPoints: 0.04, hint: '减伤 4%。' },
  {
    id: 'shield',
    name: '盾牌',
    en: 'Shield',
    category: 'shield',
    stackable: false,
    hint: '装在副手：格挡减伤更强，右键也能格挡，完美格挡可盾反。',
  },
];

export const ITEMS: Record<ItemId, ItemDef> = Object.fromEntries(
  DEFS.map((d) => [d.id, d]),
) as Record<ItemId, ItemDef>;

export const ITEM_LIST: ItemDef[] = DEFS;

export function itemName(id: ItemId): string {
  return ITEMS[id].name;
}

export function isEquipment(id: ItemId): boolean {
  const c = ITEMS[id].category;
  return c === 'tool' || c === 'weapon' || c === 'armor';
}

/** 可装备物品对应的槽位；镐不装备，只作为挖掘门槛。 */
export function equipSlotOf(id: ItemId): 'weapon' | 'offhand' | 'head' | 'chest' | 'legs' | 'feet' | null {
  switch (id) {
    case 'wooden_sword':
    case 'stone_sword':
    case 'iron_sword':
    case 'diamond_sword':
      return 'weapon';
    case 'shield':
      return 'offhand';
    case 'iron_helmet':
      return 'head';
    case 'iron_chestplate':
      return 'chest';
    case 'iron_leggings':
      return 'legs';
    case 'iron_boots':
      return 'feet';
    default:
      return null;
  }
}

export interface ResourceDef {
  kind: ResourceKind;
  name: string;
  /** 挖掘产物。 */
  item: ItemId;
  /** 所需最低镐等级，0 表示空手可挖。 */
  requiredTier: number;
  /** 门槛不足时提示的工具名。 */
  requiredToolName: string;
}

export const RESOURCES: Record<ResourceKind, ResourceDef> = {
  wood: { kind: 'wood', name: '木头', item: 'log', requiredTier: 0, requiredToolName: '空手' },
  stone: { kind: 'stone', name: '石头', item: 'cobblestone', requiredTier: 1, requiredToolName: '木镐' },
  raw_iron_block: { kind: 'raw_iron_block', name: '生铁块', item: 'raw_iron_block', requiredTier: 2, requiredToolName: '石镐' },
  gold_block: { kind: 'gold_block', name: '金块', item: 'gold_block', requiredTier: 3, requiredToolName: '铁镐' },
  diamond: { kind: 'diamond', name: '钻石矿', item: 'diamond', requiredTier: 3, requiredToolName: '铁镐' },
};

export const RESOURCE_LIST: ResourceDef[] = [
  RESOURCES.wood,
  RESOURCES.stone,
  RESOURCES.raw_iron_block,
  RESOURCES.gold_block,
  RESOURCES.diamond,
];
