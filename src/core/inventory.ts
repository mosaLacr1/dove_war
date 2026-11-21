import type { Inventory, ItemId } from './types';
import type { Ingredient } from './config/recipes';
import { ITEMS } from './config/items';

export function emptyInventory(): Inventory {
  return {};
}

export function countOf(inv: Inventory, item: ItemId): number {
  return inv[item] ?? 0;
}

export function inventoryTotal(inv: Inventory): number {
  return Object.values(inv).reduce((sum, n) => sum + (n ?? 0), 0);
}

/** 逐项检查材料是否足够。 */
export function canAfford(inv: Inventory, cost: readonly Ingredient[]): boolean {
  return cost.every((c) => countOf(inv, c.item) >= c.count);
}

/** 返回不足的材料（只含缺口项），用于 UI 展示「还差什么」。 */
export function missingFor(inv: Inventory, cost: readonly Ingredient[]): Ingredient[] {
  const out: Ingredient[] = [];
  for (const c of cost) {
    const have = countOf(inv, c.item);
    if (have < c.count) out.push({ item: c.item, count: c.count - have });
  }
  return out;
}

/** 纯函数：返回增加物品后的新库存。 */
export function addItems(inv: Inventory, gains: readonly Ingredient[]): Inventory {
  const next: Inventory = { ...inv };
  for (const g of gains) {
    next[g.item] = countOf(next, g.item) + g.count;
  }
  return next;
}

/** 纯函数：返回扣除物品后的新库存；调用方需先用 canAfford 校验。 */
export function removeItems(inv: Inventory, cost: readonly Ingredient[]): Inventory {
  const next: Inventory = { ...inv };
  for (const c of cost) {
    const left = countOf(next, c.item) - c.count;
    if (left <= 0) delete next[c.item];
    else next[c.item] = left;
  }
  return next;
}

/** 玩家拥有的最高镐等级，0 表示空手。 */
export function bestPickaxeTier(inv: Inventory): number {
  let best = 0;
  for (const [id, n] of Object.entries(inv) as [ItemId, number][]) {
    if (!n) continue;
    const def = ITEMS[id];
    if (def.pickaxeTier && def.pickaxeTier > best) best = def.pickaxeTier;
  }
  return best;
}

/** 库存展开为「物品 + 数量」数组，按物品定义顺序稳定排序。 */
export function inventoryEntries(inv: Inventory): { item: ItemId; count: number }[] {
  return (Object.keys(ITEMS) as ItemId[])
    .filter((id) => countOf(inv, id) > 0)
    .map((id) => ({ item: id, count: countOf(inv, id) }));
}
