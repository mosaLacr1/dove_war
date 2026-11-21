import { manhattan } from './map/grid';
import type { Unit } from './types';

/** 与顺序无关的 pair 键，用于交战冷却。 */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export interface Trigger {
  aId: string;
  bId: string;
}

/**
 * 找出所有应当触发决斗的组合：敌对、正交相邻、且不在冷却中。
 * 结果按 pair 键字典序排序，保证「多组同时满足」时的处理顺序确定。
 */
export function findTriggers(units: readonly Unit[], cooldowns: readonly string[]): Trigger[] {
  const cooldownSet = new Set(cooldowns);
  const alive = units.filter((u) => u.alive);
  const out: Trigger[] = [];
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i] as Unit;
      const b = alive[j] as Unit;
      if (a.owner === b.owner) continue;
      if (manhattan(a, b) !== 1) continue;
      if (cooldownSet.has(pairKey(a.id, b.id))) continue;
      out.push({ aId: a.id, bId: b.id });
    }
  }
  out.sort((x, y) => (pairKey(x.aId, x.bId) < pairKey(y.aId, y.bId) ? -1 : 1));
  return out;
}

/** 剔除已脱离相邻、或有一方已阵亡的冷却记录。 */
export function pruneCooldowns(cooldowns: readonly string[], units: readonly Unit[]): string[] {
  const byId = new Map(units.filter((u) => u.alive).map((u) => [u.id, u]));
  return cooldowns.filter((key) => {
    const [a, b] = key.split('|');
    const ua = a ? byId.get(a) : undefined;
    const ub = b ? byId.get(b) : undefined;
    if (!ua || !ub) return false;
    return manhattan(ua, ub) === 1;
  });
}
