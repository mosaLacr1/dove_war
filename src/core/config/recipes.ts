import type { ItemId } from '../types';

export interface Ingredient {
  item: ItemId;
  count: number;
}

export type RecipeCategory = 'craft' | 'uncraft' | 'smelt';

export interface Recipe {
  id: string;
  category: RecipeCategory;
  /** 产物。合成/拆解一次产出的数量，熔炼固定为 1。 */
  output: Ingredient;
  inputs: Ingredient[];
  /** 3×3 配方需要持有工作台（持有即可，不消耗）。 */
  needsTable: boolean;
  /** 熔炼消耗的燃料点；每次熔炼 2 点 = 原版「烧 1 个物品」。 */
  fuelCost: number;
  /** 对应 Minecraft 原版配方，供 UI 与自检对照。 */
  vanilla: string;
}

/**
 * 全部配方集中在这里。UI 与合成逻辑读取同一份数据，禁止在别处硬编码。
 * 基准版本：Minecraft Java Edition 1.20.4（材料数量与原版一致；工作台按「持有即用」简化，不做 3×3 摆位）。
 */
export const RECIPES: Recipe[] = [
  // ---- 基础材料（无需工作台，2×2 以内） ----
  {
    id: 'planks',
    category: 'craft',
    output: { item: 'planks', count: 4 },
    inputs: [{ item: 'log', count: 1 }],
    needsTable: false,
    fuelCost: 0,
    vanilla: '1 原木 → 4 木板（无序）',
  },
  {
    id: 'sticks',
    category: 'craft',
    output: { item: 'stick', count: 4 },
    inputs: [{ item: 'planks', count: 2 }],
    needsTable: false,
    fuelCost: 0,
    vanilla: '2 木板（竖排）→ 4 木棍',
  },
  {
    id: 'crafting_table',
    category: 'craft',
    output: { item: 'crafting_table', count: 1 },
    inputs: [{ item: 'planks', count: 4 }],
    needsTable: false,
    fuelCost: 0,
    vanilla: '2×2 木板 → 1 工作台',
  },
  {
    id: 'furnace',
    category: 'craft',
    output: { item: 'furnace', count: 1 },
    inputs: [{ item: 'cobblestone', count: 8 }],
    needsTable: true,
    fuelCost: 0,
    vanilla: '8 圆石围成环 → 1 熔炉',
  },

  // ---- 工具（3×3，需要工作台） ----
  {
    id: 'wooden_pickaxe',
    category: 'craft',
    output: { item: 'wooden_pickaxe', count: 1 },
    inputs: [
      { item: 'planks', count: 3 },
      { item: 'stick', count: 2 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '3 木板 + 2 木棍 → 1 木镐',
  },
  {
    id: 'stone_pickaxe',
    category: 'craft',
    output: { item: 'stone_pickaxe', count: 1 },
    inputs: [
      { item: 'cobblestone', count: 3 },
      { item: 'stick', count: 2 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '3 圆石 + 2 木棍 → 1 石镐',
  },
  {
    id: 'iron_pickaxe',
    category: 'craft',
    output: { item: 'iron_pickaxe', count: 1 },
    inputs: [
      { item: 'iron_ingot', count: 3 },
      { item: 'stick', count: 2 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '3 铁锭 + 2 木棍 → 1 铁镐',
  },

  // ---- 武器（3×3） ----
  {
    id: 'wooden_sword',
    category: 'craft',
    output: { item: 'wooden_sword', count: 1 },
    inputs: [
      { item: 'planks', count: 2 },
      { item: 'stick', count: 1 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '2 木板 + 1 木棍 → 1 木剑',
  },
  {
    id: 'stone_sword',
    category: 'craft',
    output: { item: 'stone_sword', count: 1 },
    inputs: [
      { item: 'cobblestone', count: 2 },
      { item: 'stick', count: 1 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '2 圆石 + 1 木棍 → 1 石剑',
  },
  {
    id: 'iron_sword',
    category: 'craft',
    output: { item: 'iron_sword', count: 1 },
    inputs: [
      { item: 'iron_ingot', count: 2 },
      { item: 'stick', count: 1 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '2 铁锭 + 1 木棍 → 1 铁剑',
  },
  {
    id: 'diamond_sword',
    category: 'craft',
    output: { item: 'diamond_sword', count: 1 },
    inputs: [
      { item: 'diamond', count: 2 },
      { item: 'stick', count: 1 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '2 钻石 + 1 木棍 → 1 钻石剑',
  },

  // ---- 护甲（3×3） ----
  {
    id: 'iron_helmet',
    category: 'craft',
    output: { item: 'iron_helmet', count: 1 },
    inputs: [{ item: 'iron_ingot', count: 5 }],
    needsTable: true,
    fuelCost: 0,
    vanilla: '5 铁锭 → 1 铁头盔',
  },
  {
    id: 'iron_chestplate',
    category: 'craft',
    output: { item: 'iron_chestplate', count: 1 },
    inputs: [{ item: 'iron_ingot', count: 8 }],
    needsTable: true,
    fuelCost: 0,
    vanilla: '8 铁锭 → 1 铁胸甲',
  },
  {
    id: 'iron_leggings',
    category: 'craft',
    output: { item: 'iron_leggings', count: 1 },
    inputs: [{ item: 'iron_ingot', count: 7 }],
    needsTable: true,
    fuelCost: 0,
    vanilla: '7 铁锭 → 1 铁护腿',
  },
  {
    id: 'iron_boots',
    category: 'craft',
    output: { item: 'iron_boots', count: 1 },
    inputs: [{ item: 'iron_ingot', count: 4 }],
    needsTable: true,
    fuelCost: 0,
    vanilla: '4 铁锭 → 1 铁靴子',
  },
  {
    id: 'shield',
    category: 'craft',
    output: { item: 'shield', count: 1 },
    inputs: [
      { item: 'planks', count: 6 },
      { item: 'iron_ingot', count: 1 },
    ],
    needsTable: true,
    fuelCost: 0,
    vanilla: '6 木板 + 1 铁锭 → 1 盾牌（装副手）',
  },

  // ---- 拆解 ----
  {
    id: 'uncraft_raw_iron_block',
    category: 'uncraft',
    output: { item: 'raw_iron', count: 9 },
    inputs: [{ item: 'raw_iron_block', count: 1 }],
    needsTable: false,
    fuelCost: 0,
    vanilla: '1 生铁块 → 9 生铁（对应原版 9 粗铁 ↔ 粗铁块；本项目的生铁块不是铁块）',
  },
  {
    id: 'uncraft_gold_block',
    category: 'uncraft',
    output: { item: 'gold_ingot', count: 9 },
    inputs: [{ item: 'gold_block', count: 1 }],
    needsTable: false,
    fuelCost: 0,
    vanilla: '1 金块 → 9 金锭',
  },

  // ---- 熔炼 ----
  {
    id: 'smelt_iron_ingot',
    category: 'smelt',
    output: { item: 'iron_ingot', count: 1 },
    inputs: [{ item: 'raw_iron', count: 1 }],
    needsTable: false,
    fuelCost: 2,
    vanilla: '生铁 → 铁锭（熔炉）；本项目把生铁块拆成 9 生铁后再烧',
  },
  {
    id: 'smelt_stone',
    category: 'smelt',
    output: { item: 'stone', count: 1 },
    inputs: [{ item: 'cobblestone', count: 1 }],
    needsTable: false,
    fuelCost: 2,
    vanilla: '圆石 → 石头（熔炉）',
  },
];

export const RECIPE_MAP: Record<string, Recipe> = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export function recipesByCategory(category: RecipeCategory): Recipe[] {
  return RECIPES.filter((r) => r.category === category);
}

export function getRecipe(id: string): Recipe | undefined {
  return RECIPE_MAP[id];
}

/** 熔炼配方在 UI 里单独按「产物」查找。 */
export function findSmeltFor(item: ItemId): Recipe | undefined {
  return RECIPES.find((r) => r.category === 'smelt' && r.output.item === item);
}
