import { doveTierFor, type DoveTier } from './config/doves';
import { ITEMS, RESOURCES } from './config/items';
import { getRecipe, type Ingredient } from './config/recipes';
import { bestPickaxeTier, countOf, missingFor } from './inventory';
import { isOrthogonallyAdjacent, orthogonalNeighbors, tileAt } from './map/grid';
import type { Coord, GameState, GearSlot, PlayerId, ResourceKind, Unit } from './types';
import { unitAt } from './units';

export interface CellHint {
  coord: Coord;
  /** 'move' 可移动；'mine' 可挖掘（含脚下）；'mine-locked' 有资源但工具不够。 */
  kind: 'move' | 'mine' | 'mine-locked';
  reason?: string;
  resource?: ResourceKind;
}

export function playerUnits(state: GameState, owner: PlayerId): Unit[] {
  return state.units.filter((u) => u.alive && u.owner === owner);
}

/** 选中斑鸠后，地图上应高亮的所有格子。 */
export function cellHints(state: GameState, unit: Unit): CellHint[] {
  if (state.phase !== 'map' || !unit.alive || unit.owner !== state.currentPlayer) return [];
  const hints: CellHint[] = [];
  const tier = bestPickaxeTier(state.players[unit.owner].inventory);

  const candidates: Coord[] = [
    { x: unit.x, y: unit.y },
    ...orthogonalNeighbors(unit.x, unit.y, state.map.width, state.map.height),
  ];

  for (const coord of candidates) {
    const tile = tileAt(state.map, coord.x, coord.y);
    if (!tile) continue;
    const isSelf = coord.x === unit.x && coord.y === unit.y;
    if (tile !== 'empty') {
      const def = RESOURCES[tile];
      const usable = tier >= def.requiredTier && unit.actionsLeft > 0;
      hints.push({
        coord,
        kind: usable ? 'mine' : 'mine-locked',
        resource: tile,
        reason: usable ? undefined : `需要${def.requiredToolName}`,
      });
      continue;
    }
    if (isSelf) continue;
    const occupant = unitAt(state.units, coord.x, coord.y);
    if (occupant) {
      if (occupant.owner !== unit.owner) {
        hints.push({ coord, kind: 'mine-locked', reason: '敌方斑鸠占据' });
      }
      continue;
    }
    if (unit.actionsLeft > 0) hints.push({ coord, kind: 'move' });
  }
  return hints;
}

export interface RecipeAvailability {
  ok: boolean;
  missing: Ingredient[];
  needsTable: boolean;
  hasTable: boolean;
  reason: string;
}

export function recipeAvailability(state: GameState, recipeId: string): RecipeAvailability {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    return { ok: false, missing: [], needsTable: false, hasTable: false, reason: '未知配方' };
  }
  const inv = state.players[state.currentPlayer].inventory;
  const missing = missingFor(inv, recipe.inputs);
  const hasTable = countOf(inv, 'crafting_table') > 0;
  const needsTable = recipe.needsTable;
  let reason = '';
  if (state.phase !== 'map') reason = '决斗中无法合成';
  else if (needsTable && !hasTable) reason = '需要工作台';
  else if (missing.length > 0) reason = `缺少 ${missing.map((m) => `${ITEMS[m.item].name}×${m.count}`).join('、')}`;
  return { ok: reason === '', missing, needsTable, hasTable, reason };
}

export function smeltAvailability(state: GameState, recipeId: string): RecipeAvailability {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, missing: [], needsTable: false, hasTable: false, reason: '未知配方' };
  const player = state.players[state.currentPlayer];
  const inv = player.inventory;
  const missing = missingFor(inv, recipe.inputs);
  const hasTable = countOf(inv, 'furnace') > 0;
  let reason = '';
  if (state.phase !== 'map') reason = '决斗中无法熔炼';
  else if (!hasTable) reason = '需要熔炉';
  else if (player.furnaceFuel < recipe.fuelCost) reason = `燃料不足（${player.furnaceFuel}/${recipe.fuelCost} 点）`;
  else if (missing.length > 0) reason = `缺少 ${missing.map((m) => `${ITEMS[m.item].name}×${m.count}`).join('、')}`;
  return { ok: reason === '', missing, needsTable: recipe.needsTable, hasTable, reason };
}

export interface DoveAvailability {
  ok: boolean;
  tier: DoveTier | null;
  reasons: string[];
  made: number;
  limit: number;
}

export function doveAvailability(state: GameState): DoveAvailability {
  const player = state.players[state.currentPlayer];
  const inv = player.inventory;
  const reasons: string[] = [];
  const tier = doveTierFor(player.dovesMade);
  const limit = 3;
  if (!tier) {
    return { ok: false, tier: null, reasons: ['已经达到新斑鸠上限'], made: player.dovesMade, limit };
  }
  for (const item of tier.consumes) {
    if (countOf(inv, item) < 1) reasons.push(`需要消耗 1 个${ITEMS[item].name}`);
  }
  if (state.phase !== 'map') reasons.push('决斗中无法孵化');
  return { ok: reasons.length === 0, tier, reasons, made: player.dovesMade, limit };
}

export function gearSlots(): GearSlot[] {
  return ['weapon', 'offhand', 'head', 'chest', 'legs', 'feet'];
}

/** 相邻且可挖掘的资源（用于键盘/提示）。 */
export function adjacentResources(state: GameState, unit: Unit): Coord[] {
  const out: Coord[] = [];
  for (const c of orthogonalNeighbors(unit.x, unit.y, state.map.width, state.map.height)) {
    const tile = tileAt(state.map, c.x, c.y);
    if (tile && tile !== 'empty') out.push(c);
  }
  return out;
}

export function isAdjacent(a: Coord, b: Coord): boolean {
  return isOrthogonallyAdjacent(a, b);
}
