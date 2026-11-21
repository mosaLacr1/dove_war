import { BALANCE } from './config/balance';
import { ITEMS, equipSlotOf } from './config/items';
import type { Equipment, ItemId, PlayerId, Unit } from './types';

export function emptyEquipment(): Equipment {
  return { weapon: null, offhand: null, head: null, chest: null, legs: null, feet: null };
}

export function createUnit(opts: {
  id: string;
  owner: PlayerId;
  x: number;
  y: number;
  spawnRound: number;
  actionsLeft: number;
}): Unit {
  return {
    id: opts.id,
    owner: opts.owner,
    x: opts.x,
    y: opts.y,
    hp: BALANCE.baseHp,
    maxHp: BALANCE.baseHp,
    actionsLeft: opts.actionsLeft,
    spawnRound: opts.spawnRound,
    equipment: emptyEquipment(),
    alive: true,
  };
}

export function equippedItems(equipment: Equipment): ItemId[] {
  const out: ItemId[] = [];
  if (equipment.weapon) out.push(equipment.weapon);
  if (equipment.offhand) out.push(equipment.offhand);
  if (equipment.head) out.push(equipment.head);
  if (equipment.chest) out.push(equipment.chest);
  if (equipment.legs) out.push(equipment.legs);
  if (equipment.feet) out.push(equipment.feet);
  return out;
}

export function hasShield(equipment: Equipment): boolean {
  return equipment.offhand === 'shield';
}

/** 护甲减伤：各件按 (1 - r) 连乘，等效「四件铁甲约 25%」。 */
export function armorReduction(equipment: Equipment): number {
  let keep = 1;
  for (const slot of ['head', 'chest', 'legs', 'feet'] as const) {
    const item = equipment[slot];
    if (!item) continue;
    keep *= 1 - (ITEMS[item].armorPoints ?? 0);
  }
  return 1 - keep;
}

/** 决斗伤害 = 基础伤害 + 武器加成。 */
export function attackDamage(equipment: Equipment): number {
  const bonus = equipment.weapon ? (ITEMS[equipment.weapon].attackBonus ?? 0) : 0;
  return BALANCE.duel.attack.baseDamage + bonus;
}

export function unitStats(unit: Unit): { damage: number; reduction: number; maxHp: number } {
  return {
    damage: attackDamage(unit.equipment),
    reduction: armorReduction(unit.equipment),
    maxHp: unit.maxHp,
  };
}

export function unitAt(units: readonly Unit[], x: number, y: number): Unit | undefined {
  return units.find((u) => u.alive && u.x === x && u.y === y);
}

export function unitById(units: readonly Unit[], id: string): Unit | undefined {
  return units.find((u) => u.id === id);
}

export function aliveUnitsOf(units: readonly Unit[], owner: PlayerId): Unit[] {
  return units.filter((u) => u.alive && u.owner === owner);
}

/** 该斑鸠能否装备此物品：槽位为空且物品属于可装备类别。 */
export function canEquip(unit: Unit, item: ItemId): { ok: boolean; reason?: string } {
  const slot = equipSlotOf(item);
  if (!slot) return { ok: false, reason: `${ITEMS[item].name} 不能装备` };
  if (unit.equipment[slot]) {
    return { ok: false, reason: `${ITEMS[item].name} 的槽位已被 ${ITEMS[unit.equipment[slot] as ItemId].name} 占用` };
  }
  return { ok: true };
}
