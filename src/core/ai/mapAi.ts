import { BALANCE } from '../config/balance';
import { difficultyOf, type MapAiProfile } from '../config/difficulty';
import { doveTierFor } from '../config/doves';
import { ITEMS, RESOURCES } from '../config/items';
import { getRecipe } from '../config/recipes';
import { bestPickaxeTier, countOf, inventoryTotal, missingFor } from '../inventory';
import { coordOf, indexOf, isOrthogonallyAdjacent, orthogonalNeighbors, tileAt } from '../map/grid';
import type { Coord, GameState, Inventory, ItemId, PlayerState, ResourceKind, Unit } from '../types';

export type AiPlan =
  | { kind: 'craft'; recipeId: string }
  | { kind: 'smelt'; recipeId: string }
  | { kind: 'fuel'; item: ItemId }
  | { kind: 'dove' }
  | { kind: 'equip'; unitId: string; item: ItemId }
  | { kind: 'mine'; unitId: string; target: Coord }
  | { kind: 'move'; unitId: string; to: Coord };

/** 电脑固定执掌玩家 1 之外的那一方。 */
const AI = 1;

const WEAPON_PREFERENCE: ItemId[] = ['diamond_sword', 'iron_sword', 'stone_sword', 'wooden_sword'];
const ARMOR_PREFERENCE: Record<'head' | 'chest' | 'legs' | 'feet', ItemId[]> = {
  head: ['iron_helmet'],
  chest: ['iron_chestplate'],
  legs: ['iron_leggings'],
  feet: ['iron_boots'],
};
const ARMOR_SLOTS = ['head', 'chest', 'legs', 'feet'] as const;
const FUEL_PREFERENCE: ItemId[] = ['stick', 'planks', 'log', 'crafting_table'];

/** 资源需求评分：越小越急；>= 8 表示「现在挖不了或不需要」。 */
function resourceScore(kind: ResourceKind, inv: Inventory, tier: number): number {
  const def = RESOURCES[kind];
  if (tier < def.requiredTier) return 8;
  switch (kind) {
    case 'wood':
      return countOf(inv, 'log') < 6 ? 0 : 7;
    case 'stone':
      return countOf(inv, 'cobblestone') < 12 ? 1 : 7;
    case 'raw_iron_block':
      return countOf(inv, 'raw_iron') < 6 ? 2 : 8;
    case 'gold_block':
      return countOf(inv, 'gold_ingot') < 2 ? 3 : 8;
    case 'diamond':
      return 4;
    default:
      return 8;
  }
}

function hasAnyWeapon(inv: Inventory): boolean {
  return WEAPON_PREFERENCE.some((w) => countOf(inv, w) > 0);
}

function planEquip(units: Unit[], inv: Inventory): AiPlan | null {
  const weapon = WEAPON_PREFERENCE.find((w) => countOf(inv, w) > 0);
  if (weapon) {
    const bare = units.find((u) => !u.equipment.weapon);
    if (bare) return { kind: 'equip', unitId: bare.id, item: weapon };
  }
  for (const unit of units) {
    if (!unit.equipment.offhand && countOf(inv, 'shield') > 0) {
      return { kind: 'equip', unitId: unit.id, item: 'shield' };
    }
  }
  for (const unit of units) {
    for (const slot of ARMOR_SLOTS) {
      if (unit.equipment[slot]) continue;
      const piece = ARMOR_PREFERENCE[slot].find((i) => countOf(inv, i) > 0);
      if (piece) return { kind: 'equip', unitId: unit.id, item: piece };
    }
  }
  return null;
}

function planCraft(inv: Inventory, units: Unit[]): AiPlan | null {
  const tier = bestPickaxeTier(inv);
  const table = countOf(inv, 'crafting_table');
  const recipes: { id: string; want: boolean }[] = [
    { id: 'planks', want: countOf(inv, 'log') > 0 && countOf(inv, 'planks') < 10 },
    { id: 'sticks', want: countOf(inv, 'planks') >= 2 && countOf(inv, 'stick') < 8 },
    { id: 'crafting_table', want: table === 0 && countOf(inv, 'planks') >= 4 },
    { id: 'wooden_pickaxe', want: tier < 1 },
    { id: 'stone_pickaxe', want: tier < 2 && countOf(inv, 'cobblestone') >= 3 },
    { id: 'stone_sword', want: !hasAnyWeapon(inv) && countOf(inv, 'cobblestone') >= 2 },
    { id: 'furnace', want: countOf(inv, 'furnace') === 0 && countOf(inv, 'cobblestone') >= 8 },
    {
      id: 'shield',
      want:
        countOf(inv, 'shield') === 0 &&
        units.every((u) => !u.equipment.offhand) &&
        countOf(inv, 'planks') >= 10 &&
        countOf(inv, 'iron_ingot') >= 2,
    },
    { id: 'iron_pickaxe', want: tier < 3 && countOf(inv, 'iron_ingot') >= 3 },
    {
      id: 'iron_sword',
      want: countOf(inv, 'iron_sword') === 0 && units.some((u) => !u.equipment.weapon) && countOf(inv, 'iron_ingot') >= 2,
    },
    {
      id: 'iron_chestplate',
      want: countOf(inv, 'iron_ingot') >= 8 && units.some((u) => !u.equipment.chest),
    },
    {
      id: 'iron_helmet',
      want: countOf(inv, 'iron_ingot') >= 5 && units.some((u) => !u.equipment.head),
    },
  ];

  for (const entry of recipes) {
    if (!entry.want) continue;
    const recipe = getRecipe(entry.id);
    if (!recipe) continue;
    if (recipe.needsTable && countOf(inv, 'crafting_table') < 1) continue;
    if (missingFor(inv, recipe.inputs).length > 0) continue;
    return { kind: 'craft', recipeId: entry.id };
  }
  return null;
}

function planSmelt(inv: Inventory, player: PlayerState): AiPlan | null {
  if (countOf(inv, 'furnace') < 1) return null;
  if (countOf(inv, 'raw_iron') < 1) return null;
  if (player.furnaceFuel >= 2) return { kind: 'smelt', recipeId: 'smelt_iron_ingot' };

  for (const item of FUEL_PREFERENCE) {
    if (countOf(inv, item) < 1) continue;
    if (!ITEMS[item].fuelPoints) continue;
    if (item === 'crafting_table' && countOf(inv, 'crafting_table') <= 1) continue;
    if (item === 'planks' && countOf(inv, 'planks') < 6) continue;
    if (item === 'log' && countOf(inv, 'log') < 2) continue;
    return { kind: 'fuel', item };
  }
  return null;
}

function planDove(player: PlayerState, inv: Inventory, profile: MapAiProfile): AiPlan | null {
  if (player.dovesMade >= BALANCE.doveLimit) return null;
  const tier = doveTierFor(player.dovesMade);
  if (!tier) return null;
  if (!tier.consumes.every((item) => countOf(inv, item) > 0)) return null;
  // 孵化不再消耗材料，用"资源富余程度"表达难度差异：低难度更恋战、不爱分兵
  const surplus = profile.expandChance < 0.3 ? 90 : profile.expandChance < 0.6 ? 45 : 12;
  if (inventoryTotal(inv) < surplus) return null;
  return { kind: 'dove' };
}

function scoreAt(state: GameState, x: number, y: number, tier: number, inv: Inventory): number {
  const tile = tileAt(state.map, x, y);
  if (!tile || tile === 'empty') return 99;
  return resourceScore(tile, inv, tier);
}

function adjacentMineTarget(state: GameState, unit: Unit, inv: Inventory): Coord | null {
  const tier = bestPickaxeTier(inv);
  const cells: Coord[] = [
    { x: unit.x, y: unit.y },
    ...orthogonalNeighbors(unit.x, unit.y, state.map.width, state.map.height),
  ];
  let best: Coord | null = null;
  let bestScore = 99;
  for (const cell of cells) {
    const score = scoreAt(state, cell.x, cell.y, tier, inv);
    if (score < 8 && score < bestScore) {
      bestScore = score;
      best = cell;
    }
  }
  return best;
}

function bfsFirstStep(state: GameState, unit: Unit, accept: (x: number, y: number) => boolean): Coord | null {
  const { width, height } = state.map;
  const start = indexOf(unit.x, unit.y, width);
  const parent = new Map<number, number>();
  const seen = new Set<number>([start]);
  const blocked = new Set(
    state.units.filter((u) => u.alive && u.id !== unit.id).map((u) => indexOf(u.x, u.y, width)),
  );
  const queue: number[] = [start];

  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head] as number;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    if (cur !== start && accept(cx, cy)) {
      let node = cur;
      let p = parent.get(node);
      while (p !== undefined && p !== start) {
        node = p;
        p = parent.get(node);
      }
      return p === start ? coordOf(node, width) : null;
    }
    for (const cell of orthogonalNeighbors(cx, cy, width, height)) {
      const ni = indexOf(cell.x, cell.y, width);
      if (seen.has(ni) || blocked.has(ni)) continue;
      seen.add(ni);
      parent.set(ni, cur);
      queue.push(ni);
    }
  }
  return null;
}

function pathToResource(state: GameState, unit: Unit, inv: Inventory): Coord | null {
  const tier = bestPickaxeTier(inv);
  return bfsFirstStep(state, unit, (x, y) => scoreAt(state, x, y, tier, inv) <= 4);
}

function stepTowardEnemy(state: GameState, unit: Unit): Coord | null {
  const enemies = state.units.filter((u) => u.alive && u.owner !== unit.owner);
  if (enemies.length === 0) return null;
  return bfsFirstStep(state, unit, (x, y) =>
    enemies.some((e) => isOrthogonallyAdjacent({ x, y }, { x: e.x, y: e.y })),
  );
}

function planMapAction(state: GameState, units: Unit[], inv: Inventory): AiPlan | null {
  const active = units.filter((u) => u.actionsLeft > 0);
  if (active.length === 0) return null;

  for (const unit of active) {
    const target = adjacentMineTarget(state, unit, inv);
    if (target) return { kind: 'mine', unitId: unit.id, target };
  }

  for (const unit of active) {
    const step = pathToResource(state, unit, inv);
    if (step) return { kind: 'move', unitId: unit.id, to: step };
  }

  // 可采资源枯竭：主动向对手推进，逼出决斗。
  for (const unit of active) {
    const step = stepTowardEnemy(state, unit);
    if (step) return { kind: 'move', unitId: unit.id, to: step };
  }
  return null;
}

export function planAiStep(state: GameState): AiPlan | null {
  if (state.currentPlayer !== AI) return null;
  const player = state.players[AI];
  const inv = player.inventory;
  const profile = difficultyOf(state.difficulty).map;
  const units = state.units.filter((u) => u.alive && u.owner === AI);
  if (units.length === 0) return null;

  return (
    planEquip(units, inv) ??
    planCraft(inv, units) ??
    planSmelt(inv, player) ??
    planDove(player, inv, profile) ??
    planMapAction(state, units, inv)
  );
}
