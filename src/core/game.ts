import { findTriggers, pairKey, pruneCooldowns } from './adjacency';
import { planAiStep } from './ai/mapAi';
import { BALANCE } from './config/balance';
import { difficultyOf, type DifficultyId } from './config/difficulty';
import { doveTierFor } from './config/doves';
import { ITEMS, RESOURCES, equipSlotOf } from './config/items';
import { getRecipe, type Ingredient } from './config/recipes';
import {
  addItems,
  bestPickaxeTier,
  countOf,
  emptyInventory,
  missingFor,
  removeItems,
} from './inventory';
import { generateMap } from './map/generate';
import {
  bfsDistances,
  indexOf,
  inBounds,
  isOrthogonallyAdjacent,
  setTile,
  tileAt,
} from './map/grid';
import { hashSeed, randomSeed } from './rng';
import type {
  ActionResult,
  Coord,
  DuelFighterInit,
  DuelResult,
  GameState,
  GearSlot,
  ItemId,
  LogEntry,
  PlayerId,
  PlayerState,
  Unit,
} from './types';
import { canEquip, createUnit, equippedItems, hasShield, unitAt, unitById, unitStats } from './units';

const PLAYER_NAMES = ['玩家 1', '电脑'] as const;

export function playerName(id: PlayerId): string {
  return PLAYER_NAMES[id];
}

export function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function pushLog(draft: GameState, text: string, kind: LogEntry['kind'] = 'info'): void {
  draft.log.push({ id: draft.nextLogId, text, kind, round: draft.round });
  draft.nextLogId += 1;
  if (draft.log.length > 80) draft.log.splice(0, draft.log.length - 80);
}

function ok(state: GameState, message = ''): ActionResult {
  return { ok: true, state, message };
}

function fail(state: GameState, message: string): ActionResult {
  return { ok: false, state, message };
}

export function createGame(seed: string = randomSeed(), difficulty: DifficultyId = 'normal'): GameState {
  const map = generateMap(seed);
  const players: [PlayerState, PlayerState] = [
    { id: 0, name: PLAYER_NAMES[0], inventory: emptyInventory(), furnaceFuel: 0, dovesMade: 0 },
    { id: 1, name: PLAYER_NAMES[1], inventory: emptyInventory(), furnaceFuel: 0, dovesMade: 0 },
  ];
  const units: Unit[] = [
    createUnit({
      id: 'p1-1',
      owner: 0,
      x: BALANCE.map.spawn[0].x,
      y: BALANCE.map.spawn[0].y,
      spawnRound: 0,
      actionsLeft: BALANCE.actionsPerDove,
    }),
    createUnit({
      id: 'p2-1',
      owner: 1,
      x: BALANCE.map.spawn[1].x,
      y: BALANCE.map.spawn[1].y,
      spawnRound: 0,
      actionsLeft: BALANCE.actionsPerDove,
    }),
  ];

  const state: GameState = {
    seed,
    difficulty,
    map,
    players,
    units,
    round: 1,
    currentPlayer: 0,
    phase: 'map',
    duel: null,
    cooldowns: [],
    winner: null,
    log: [],
    nextUnitSeq: 2,
    nextLogId: 1,
    duelSeq: 0,
  };

  pushLog(state, `新对局开始 · 种子 ${seed} · 难度 ${difficultyOf(difficulty).label}`, 'success');
  if (!map.valid) pushLog(state, '警告：地图未通过公平性校验（已重试上限）', 'warn');
  pushLog(state, '空手采木头 → 木板 → 工作台 → 木镐，是第一段科技。', 'info');
  return state;
}

/* ------------------------------------------------------------------ *
 * 内部流程
 * ------------------------------------------------------------------ */

function advancePlayer(draft: GameState, depth = 0): void {
  const next: PlayerId = draft.currentPlayer === 0 ? 1 : 0;
  draft.currentPlayer = next;
  if (next === 0) draft.round += 1;
  for (const u of draft.units) {
    if (!u.alive || u.owner !== next) continue;
    u.actionsLeft = u.spawnRound < draft.round ? BALANCE.actionsPerDove : 0;
  }
  pushLog(draft, `轮到 ${playerName(next)}（第 ${draft.round} 回合）`, 'info');
  autoAdvanceIfStuck(draft, depth + 1);
}

/** 当前玩家没有任何可行动斑鸠（例如只有刚孵化的幼鸟）时自动跳过。 */
function autoAdvanceIfStuck(draft: GameState, depth = 0): void {
  if (depth > 3 || draft.phase !== 'map') return;
  const mine = draft.units.filter((u) => u.alive && u.owner === draft.currentPlayer);
  if (mine.some((u) => u.actionsLeft > 0)) return;
  advancePlayer(draft, depth);
}

function checkVictory(draft: GameState): void {
  const alive0 = draft.units.some((u) => u.alive && u.owner === 0);
  const alive1 = draft.units.some((u) => u.alive && u.owner === 1);
  if (alive0 && alive1) return;
  draft.phase = 'over';
  draft.duel = null;
  if (!alive0 && !alive1) {
    draft.winner = 'draw';
    pushLog(draft, '双方斑鸠同归于尽，判为平局', 'duel');
  } else if (!alive0) {
    draft.winner = 1;
    pushLog(draft, '玩家 1 的斑鸠全部阵亡，电脑获胜', 'duel');
  } else {
    draft.winner = 0;
    pushLog(draft, '电脑的斑鸠全部阵亡，玩家 1 获胜', 'duel');
  }
}

function startDuel(draft: GameState, aId: string, bId: string): void {
  const a = draft.units.find((u) => u.id === aId);
  const b = draft.units.find((u) => u.id === bId);
  if (!a || !b) return;
  const leftUnit = a.owner === 0 ? a : b;
  const rightUnit = a.owner === 0 ? b : a;
  const damageScale = difficultyOf(draft.difficulty).duel.damageScale;
  const mk = (unit: Unit): DuelFighterInit => {
    const stats = unitStats(unit);
    return {
      unitId: unit.id,
      owner: unit.owner,
      damage: stats.damage * (unit.owner === 1 ? damageScale : 1),
      reduction: stats.reduction,
      maxHp: stats.maxHp,
      shield: hasShield(unit.equipment),
    };
  };
  draft.duelSeq += 1;
  draft.duel = {
    left: mk(leftUnit),
    right: mk(rightUnit),
    seed: hashSeed(`${draft.seed}#duel#${draft.duelSeq}#${pairKey(a.id, b.id)}`),
  };
  draft.phase = 'duel';
  pushLog(draft, `⚔ ${leftUnit.id} 与 ${rightUnit.id} 进入决斗`, 'duel');
}

/** 每次局面变化后的统一收尾：冷却清理 → 触发决斗 → 回合推进。 */
function afterAction(draft: GameState): void {
  draft.cooldowns = pruneCooldowns(draft.cooldowns, draft.units);
  if (draft.phase !== 'map') return;
  const triggers = findTriggers(draft.units, draft.cooldowns);
  if (triggers.length > 0) {
    const first = triggers[0] as { aId: string; bId: string };
    startDuel(draft, first.aId, first.bId);
    return;
  }
  autoAdvanceIfStuck(draft);
}

/* ------------------------------------------------------------------ *
 * 动作：地图阶段
 * ------------------------------------------------------------------ */

function guardTurn(state: GameState, unit: Unit): string | null {
  if (state.phase !== 'map') return '决斗进行中，暂时无法操作地图';
  if (!unit.alive) return '该斑鸠已被摧毁';
  if (unit.owner !== state.currentPlayer) return '现在是对手的回合';
  if (unit.actionsLeft <= 0) return '这只斑鸠本回合的行动已经用完';
  return null;
}

export function moveUnit(state: GameState, unitId: string, to: Coord): ActionResult {
  const unit = unitById(state.units, unitId);
  if (!unit) return fail(state, '找不到该斑鸠');
  const guard = guardTurn(state, unit);
  if (guard) return fail(state, guard);
  if (!inBounds(to.x, to.y, state.map.width, state.map.height)) return fail(state, '目标格子在地图之外');
  if (unit.x === to.x && unit.y === to.y) return fail(state, '它已经在这个格子上了');
  if (!isOrthogonallyAdjacent(unit, to)) {
    const diagonal = Math.abs(unit.x - to.x) === Math.abs(unit.y - to.y);
    return fail(state, diagonal ? '不能斜向移动，只能走上下左右' : '一次只能移动到相邻的一格');
  }
  const occupant = unitAt(state.units, to.x, to.y);
  if (occupant) {
    return fail(state, occupant.owner === unit.owner ? '那一格已经有己方斑鸠' : '那一格被敌方斑鸠占据');
  }

  const draft = cloneState(state);
  const moving = unitById(draft.units, unitId) as Unit;
  moving.x = to.x;
  moving.y = to.y;
  moving.actionsLeft -= 1;
  pushLog(draft, `${moving.id} 移动到 (${to.x + 1}, ${to.y + 1})`);
  afterAction(draft);
  return ok(draft);
}

export function mineResource(state: GameState, unitId: string, target: Coord): ActionResult {
  const unit = unitById(state.units, unitId);
  if (!unit) return fail(state, '找不到该斑鸠');
  const guard = guardTurn(state, unit);
  if (guard) return fail(state, guard);

  const tile = tileAt(state.map, target.x, target.y);
  if (!tile) return fail(state, '目标格子在地图之外');
  if (tile === 'empty') return fail(state, '这里没有可挖掘的资源');

  const sameTile = unit.x === target.x && unit.y === target.y;
  if (!sameTile && !isOrthogonallyAdjacent(unit, target)) {
    return fail(state, '只能挖掘脚下或正交相邻的资源');
  }

  const def = RESOURCES[tile];
  const tier = bestPickaxeTier(state.players[unit.owner].inventory);
  if (tier < def.requiredTier) {
    return fail(state, `挖掘${def.name}需要${def.requiredToolName}，你目前只有${tier === 0 ? '空手' : `等级 ${tier} 的镐`}`);
  }

  const draft = cloneState(state);
  const worker = unitById(draft.units, unitId) as Unit;
  setTile(draft.map, target.x, target.y, 'empty');
  draft.players[worker.owner].inventory = addItems(draft.players[worker.owner].inventory, [
    { item: def.item, count: 1 },
  ]);
  worker.actionsLeft -= 1;
  const gain = ITEMS[def.item].name;
  pushLog(draft, `${worker.id} 挖掘${def.name}，获得 ${gain} ×1`, 'success');
  afterAction(draft);
  return ok(draft, `获得 ${gain} ×1`);
}

export function craftRecipe(state: GameState, recipeId: string): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法合成');
  const recipe = getRecipe(recipeId);
  if (!recipe) return fail(state, '未知配方');
  if (recipe.category === 'smelt') return fail(state, '熔炼需要在熔炉里进行');

  const player = state.players[state.currentPlayer];
  const inv = player.inventory;
  if (recipe.needsTable && countOf(inv, 'crafting_table') < 1) {
    return fail(state, '这个配方需要工作台');
  }
  const missing = missingFor(inv, recipe.inputs);
  if (missing.length > 0) {
    return fail(state, `材料不足：${missing.map((m) => `${ITEMS[m.item].name}×${m.count}`).join('、')}`);
  }

  const draft = cloneState(state);
  const p = draft.players[draft.currentPlayer];
  p.inventory = addItems(removeItems(p.inventory, recipe.inputs), [recipe.output]);
  const name = ITEMS[recipe.output.item].name;
  pushLog(draft, `合成 ${name} ×${recipe.output.count}`, 'success');
  afterAction(draft);
  return ok(draft, `合成 ${name} ×${recipe.output.count}`);
}

export function addFuel(state: GameState, item: ItemId): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法操作熔炉');
  const def = ITEMS[item];
  if (!def.fuelPoints) return fail(state, `${def.name} 不能作为燃料`);
  const player = state.players[state.currentPlayer];
  if (countOf(player.inventory, item) < 1) return fail(state, `库存里没有${def.name}`);
  if (countOf(player.inventory, 'furnace') < 1) return fail(state, '需要熔炉');

  const draft = cloneState(state);
  const p = draft.players[draft.currentPlayer];
  p.inventory = removeItems(p.inventory, [{ item, count: 1 }]);
  p.furnaceFuel += def.fuelPoints as number;
  pushLog(draft, `投入${def.name}，燃料 +${def.fuelPoints} 点（现有 ${p.furnaceFuel} 点）`, 'info');
  afterAction(draft);
  return ok(draft, `燃料 +${def.fuelPoints} 点`);
}

export function smeltItem(state: GameState, recipeId: string): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法熔炼');
  const recipe = getRecipe(recipeId);
  if (!recipe || recipe.category !== 'smelt') return fail(state, '未知熔炼配方');

  const player = state.players[state.currentPlayer];
  const inv = player.inventory;
  if (countOf(inv, 'furnace') < 1) return fail(state, '需要先合成熔炉');
  if (player.furnaceFuel < recipe.fuelCost) {
    return fail(state, `燃料不足（需要 ${recipe.fuelCost} 点，现有 ${player.furnaceFuel} 点）`);
  }
  const missing = missingFor(inv, recipe.inputs);
  if (missing.length > 0) {
    return fail(state, `材料不足：${missing.map((m) => `${ITEMS[m.item].name}×${m.count}`).join('、')}`);
  }

  const draft = cloneState(state);
  const p = draft.players[draft.currentPlayer];
  p.inventory = addItems(removeItems(p.inventory, recipe.inputs), [recipe.output]);
  p.furnaceFuel -= recipe.fuelCost;
  const name = ITEMS[recipe.output.item].name;
  pushLog(draft, `熔炼产出 ${name} ×${recipe.output.count}`, 'success');
  afterAction(draft);
  return ok(draft, `熔炼 ${name} ×1`);
}

function findSpawnTile(state: GameState, owner: PlayerId): Coord | null {
  const { width, height } = state.map;
  const spawn = { x: BALANCE.map.spawn[owner].x, y: BALANCE.map.spawn[owner].y };
  const dist = bfsDistances(state.map, spawn);
  let best: Coord | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = dist[indexOf(x, y, width)] as number;
      if (d < 0) continue;
      if (unitAt(state.units, x, y)) continue;
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

export function craftDove(state: GameState): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法孵化新斑鸠');
  const player = state.players[state.currentPlayer];
  if (player.dovesMade >= BALANCE.doveLimit) {
    return fail(state, `新斑鸠上限为 ${BALANCE.doveLimit} 只，已经用完`);
  }
  const tier = doveTierFor(player.dovesMade);
  if (!tier) return fail(state, '没有更多可解锁的新斑鸠');

  for (const item of tier.consumes) {
    if (countOf(player.inventory, item) < 1) {
      return fail(state, `${tier.label}需要消耗 1 个${ITEMS[item].name}`);
    }
  }

  const spawn = findSpawnTile(state, state.currentPlayer);
  if (!spawn) return fail(state, '出生点周围没有空位');

  const draft = cloneState(state);
  const p = draft.players[draft.currentPlayer];
  // 只扣门槛道具；cost 只是"持有要求"，孵化后材料原样保留
  const spentTools: Ingredient[] = tier.consumes.map((item) => ({ item, count: 1 }));
  p.inventory = removeItems(p.inventory, spentTools);
  p.dovesMade += 1;

  const index = draft.units.filter((u) => u.owner === draft.currentPlayer).length + 1;
  const unit = createUnit({
    id: `p${draft.currentPlayer + 1}-${index}`,
    owner: draft.currentPlayer,
    x: spawn.x,
    y: spawn.y,
    spawnRound: draft.round,
    actionsLeft: 0,
  });
  draft.units.push(unit);
  pushLog(
    draft,
    `${tier.label}孵化完成：消耗 ${tier.consumes.map((item) => ITEMS[item].name).join('、')}，材料保留，下一回合开始行动`,
    'success',
  );

  afterAction(draft);
  return ok(draft, '新斑鸠已孵化，下一回合才能行动');
}

export function equipItem(state: GameState, unitId: string, item: ItemId): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法更换装备');
  const unit = unitById(state.units, unitId);
  if (!unit) return fail(state, '找不到该斑鸠');
  if (unit.owner !== state.currentPlayer) return fail(state, '只能给自己的斑鸠装备');

  const check = canEquip(unit, item);
  if (!check.ok) return fail(state, check.reason as string);
  const player = state.players[state.currentPlayer];
  if (countOf(player.inventory, item) < 1) return fail(state, `库存里没有${ITEMS[item].name}`);

  const slot = equipSlotOf(item) as GearSlot;
  const draft = cloneState(state);
  const target = unitById(draft.units, unitId) as Unit;
  draft.players[draft.currentPlayer].inventory = removeItems(draft.players[draft.currentPlayer].inventory, [
    { item, count: 1 },
  ]);
  target.equipment[slot] = item;
  pushLog(draft, `${target.id} 装备 ${ITEMS[item].name}`, 'success');
  afterAction(draft);
  return ok(draft, `装备 ${ITEMS[item].name}`);
}

export function unequipItem(state: GameState, unitId: string, slot: GearSlot): ActionResult {
  if (state.phase !== 'map') return fail(state, '决斗进行中，无法更换装备');
  const unit = unitById(state.units, unitId);
  if (!unit) return fail(state, '找不到该斑鸠');
  if (unit.owner !== state.currentPlayer) return fail(state, '只能操作自己的斑鸠');
  const item = unit.equipment[slot];
  if (!item) return fail(state, '该槽位没有装备');

  const draft = cloneState(state);
  const target = unitById(draft.units, unitId) as Unit;
  target.equipment[slot] = null;
  draft.players[draft.currentPlayer].inventory = addItems(
    draft.players[draft.currentPlayer].inventory,
    [{ item, count: 1 }],
  );
  pushLog(draft, `${target.id} 卸下 ${ITEMS[item].name}`, 'info');
  afterAction(draft);
  return ok(draft, `卸下 ${ITEMS[item].name}`);
}

export function endTurn(state: GameState): ActionResult {
  if (state.phase !== 'map') return fail(state, '现在不能结束回合');
  const draft = cloneState(state);
  advancePlayer(draft);
  return ok(draft);
}

/* ------------------------------------------------------------------ *
 * 决斗结算
 * ------------------------------------------------------------------ */

export function finishDuel(state: GameState, result: DuelResult): ActionResult {
  if (!state.duel) return fail(state, '当前没有进行中的决斗');

  const draft = cloneState(state);
  const config = draft.duel as NonNullable<GameState['duel']>;

  if (result.kind !== 'draw' && result.loserUnitId) {
    const loser = draft.units.find((u) => u.id === result.loserUnitId);
    if (loser) {
      loser.alive = false;
      loser.actionsLeft = 0;
      pushLog(draft, `${loser.id} 被摧毁（装备不掉落，随斑鸠消失）`, 'duel');
    }
  } else {
    pushLog(draft, '平局：双方斑鸠都返回地图', 'duel');
  }

  const left = draft.units.find((u) => u.id === config.left.unitId);
  const right = draft.units.find((u) => u.id === config.right.unitId);
  if (left?.alive && right?.alive) {
    const key = pairKey(left.id, right.id);
    if (!draft.cooldowns.includes(key)) draft.cooldowns.push(key);
  }

  pushLog(
    draft,
    `决斗结束：${result.reason}（${Math.round(result.leftHp)} : ${Math.round(result.rightHp)}）`,
    'duel',
  );

  draft.duel = null;
  draft.phase = 'map';
  checkVictory(draft);
  if (draft.phase === 'map') afterAction(draft);
  return ok(draft);
}

/* ------------------------------------------------------------------ *
 * 电脑对手
 * ------------------------------------------------------------------ */

/** 执行电脑的一小步（一个动作）；返回 null 表示本回合已无动作可做。 */
export function aiTurnStep(state: GameState): ActionResult | null {
  if (state.phase !== 'map' || state.currentPlayer !== 1) return null;
  const plan = planAiStep(state);
  if (!plan) return endTurn(state);

  let result: ActionResult | null = null;
  switch (plan.kind) {
    case 'craft':
      result = craftRecipe(state, plan.recipeId);
      break;
    case 'smelt':
      result = smeltItem(state, plan.recipeId);
      break;
    case 'fuel':
      result = addFuel(state, plan.item);
      break;
    case 'dove':
      result = craftDove(state);
      break;
    case 'equip':
      result = equipItem(state, plan.unitId, plan.item);
      break;
    case 'mine':
      result = mineResource(state, plan.unitId, plan.target);
      break;
    case 'move':
      result = moveUnit(state, plan.unitId, plan.to);
      break;
    default:
      result = null;
  }

  if (!result || !result.ok) return endTurn(state);
  return result;
}

/* ------------------------------------------------------------------ *
 * 查询辅助
 * ------------------------------------------------------------------ */

export function canCurrentPlayerAct(state: GameState): boolean {
  if (state.phase !== 'map') return false;
  return state.units.some((u) => u.alive && u.owner === state.currentPlayer && u.actionsLeft > 0);
}

export function unitSummary(unit: Unit): string {
  const gear = equippedItems(unit.equipment);
  const stats = unitStats(unit);
  const gearText = gear.length > 0 ? gear.map((g) => ITEMS[g].name).join('/') : '赤手空拳';
  return `${gearText} · 伤害 ${stats.damage} · 减伤 ${Math.round(stats.reduction * 100)}%`;
}
