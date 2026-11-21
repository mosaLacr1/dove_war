import { describe, expect, it } from 'vitest';
import { addFuel, craftDove, craftRecipe, createGame, equipItem, smeltItem } from '../src/core/game';
import { countOf } from '../src/core/inventory';
import type { GameState, Inventory } from '../src/core/types';

function stateWith(inventory: Inventory): GameState {
  const state = createGame('CRAFT-TEST');
  state.players[0].inventory = { ...inventory };
  return state;
}

describe('合成配方（Minecraft 1.20.4 数量）', () => {
  it('1 原木 → 4 木板', () => {
    const result = craftRecipe(stateWith({ log: 2 }), 'planks');
    expect(result.ok).toBe(true);
    expect(countOf(result.state.players[0].inventory, 'planks')).toBe(4);
    expect(countOf(result.state.players[0].inventory, 'log')).toBe(1);
  });

  it('2 木板 → 4 木棍', () => {
    const result = craftRecipe(stateWith({ planks: 2 }), 'sticks');
    expect(result.ok).toBe(true);
    expect(countOf(result.state.players[0].inventory, 'stick')).toBe(4);
  });

  it('4 木板 → 工作台，8 圆石 → 熔炉（需要工作台）', () => {
    const table = craftRecipe(stateWith({ planks: 4 }), 'crafting_table');
    expect(table.ok).toBe(true);
    expect(countOf(table.state.players[0].inventory, 'crafting_table')).toBe(1);

    const furnace = craftRecipe(stateWith({ cobblestone: 8, crafting_table: 1 }), 'furnace');
    expect(furnace.ok).toBe(true);
    expect(countOf(furnace.state.players[0].inventory, 'furnace')).toBe(1);
  });

  it('3×3 配方缺少工作台时被拒绝，并给出原因', () => {
    const result = craftRecipe(stateWith({ planks: 3, stick: 2 }), 'wooden_pickaxe');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('工作台');
  });

  it('木镐 / 石镐 / 铁镐的材料数量正确', () => {
    const wooden = craftRecipe(stateWith({ planks: 3, stick: 2, crafting_table: 1 }), 'wooden_pickaxe');
    expect(wooden.ok).toBe(true);

    const stone = craftRecipe(stateWith({ cobblestone: 3, stick: 2, crafting_table: 1 }), 'stone_pickaxe');
    expect(stone.ok).toBe(true);
    expect(countOf(stone.state.players[0].inventory, 'cobblestone')).toBe(0);

    const iron = craftRecipe(stateWith({ iron_ingot: 3, stick: 2, crafting_table: 1 }), 'iron_pickaxe');
    expect(iron.ok).toBe(true);
  });

  it('剑与护甲配方材料数量正确', () => {
    const sword = craftRecipe(stateWith({ diamond: 2, stick: 1, crafting_table: 1 }), 'diamond_sword');
    expect(sword.ok).toBe(true);

    const chest = craftRecipe(stateWith({ iron_ingot: 8, crafting_table: 1 }), 'iron_chestplate');
    expect(chest.ok).toBe(true);

    const boots = craftRecipe(stateWith({ iron_ingot: 4, crafting_table: 1 }), 'iron_boots');
    expect(boots.ok).toBe(true);
  });

  it('盾牌：6 木板 + 1 铁锭，可装备到副手', () => {
    const craft = craftRecipe(stateWith({ planks: 6, iron_ingot: 1, crafting_table: 1 }), 'shield');
    expect(craft.ok).toBe(true);
    expect(countOf(craft.state.players[0].inventory, 'shield')).toBe(1);
    expect(countOf(craft.state.players[0].inventory, 'planks')).toBe(0);

    const equip = equipItem(craft.state, craft.state.units[0]!.id, 'shield');
    expect(equip.ok).toBe(true);
    expect(equip.state.units[0]?.equipment.offhand).toBe('shield');
    expect(countOf(equip.state.players[0].inventory, 'shield')).toBe(0);
  });

  it('材料不足时不扣减任何库存（原子性）', () => {
    const state = stateWith({ planks: 2 });
    const result = craftRecipe(state, 'crafting_table');
    expect(result.ok).toBe(false);
    expect(countOf(result.state.players[0].inventory, 'planks')).toBe(2);
  });
});

describe('拆解与熔炼', () => {
  it('1 生铁块 → 9 生铁', () => {
    const result = craftRecipe(stateWith({ raw_iron_block: 2 }), 'uncraft_raw_iron_block');
    expect(result.ok).toBe(true);
    expect(countOf(result.state.players[0].inventory, 'raw_iron')).toBe(9);
    expect(countOf(result.state.players[0].inventory, 'raw_iron_block')).toBe(1);
  });

  it('1 金块 → 9 金锭', () => {
    const result = craftRecipe(stateWith({ gold_block: 1 }), 'uncraft_gold_block');
    expect(result.ok).toBe(true);
    expect(countOf(result.state.players[0].inventory, 'gold_ingot')).toBe(9);
  });

  it('生铁不能直接当铁锭用：铁镐需要铁锭', () => {
    const result = craftRecipe(stateWith({ raw_iron: 3, stick: 2, crafting_table: 1 }), 'iron_pickaxe');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('铁锭');
  });

  it('熔炼需要熔炉与燃料点', () => {
    const noFurnace = smeltItem(stateWith({ raw_iron: 1 }), 'smelt_iron_ingot');
    expect(noFurnace.ok).toBe(false);
    expect(noFurnace.message).toContain('熔炉');

    const noFuel = smeltItem(stateWith({ raw_iron: 1, furnace: 1 }), 'smelt_iron_ingot');
    expect(noFuel.ok).toBe(false);
    expect(noFuel.message).toContain('燃料');
  });

  it('1 块木板提供 3 点燃料，可烧 1 次并余 1 点（对应原版 1.5 个物品）', () => {
    const base = stateWith({ raw_iron: 3, furnace: 1, planks: 1 });
    const fueled = addFuel(base, 'planks');
    expect(fueled.ok).toBe(true);
    expect(fueled.state.players[0].furnaceFuel).toBe(3);

    const first = smeltItem(fueled.state, 'smelt_iron_ingot');
    expect(first.ok).toBe(true);
    expect(first.state.players[0].furnaceFuel).toBe(1);
    expect(countOf(first.state.players[0].inventory, 'iron_ingot')).toBe(1);

    const second = smeltItem(first.state, 'smelt_iron_ingot');
    expect(second.ok).toBe(false);
  });

  it('圆石可以熔炼成石头', () => {
    const state = stateWith({ cobblestone: 1, furnace: 1, stick: 2 });
    const fueled = addFuel(state, 'stick');
    expect(fueled.state.players[0].furnaceFuel).toBe(1);
    const fueled2 = addFuel(fueled.state, 'stick');
    const result = smeltItem(fueled2.state, 'smelt_stone');
    expect(result.ok).toBe(true);
    expect(countOf(result.state.players[0].inventory, 'stone')).toBe(1);
  });
});

describe('新斑鸠（自定义配方）', () => {
  const tier1 = { crafting_table: 1 };

  it('第一只新斑鸠只消耗工作台，不需要任何材料', () => {
    const result = craftDove(stateWith(tier1));
    expect(result.ok).toBe(true);
    const inv = result.state.players[0].inventory;
    expect(countOf(inv, 'crafting_table')).toBe(0);
    expect(Object.values(inv).reduce((sum, n) => sum + (n ?? 0), 0)).toBe(0);
    expect(result.state.players[0].dovesMade).toBe(1);
    expect(result.state.units.filter((u) => u.alive && u.owner === 0)).toHaveLength(2);
  });

  it('缺少门槛道具时拒绝孵化', () => {
    const result = craftDove(stateWith({ log: 6, planks: 4 }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('工作台');
  });

  it('第二只要求消耗石镐，第三只要求铁剑', () => {
    const state = stateWith(tier1);
    const first = craftDove(state);
    expect(first.ok).toBe(true);

    const noPick = craftDove({
      ...first.state,
      players: [{ ...first.state.players[0], inventory: { crafting_table: 1 } }, first.state.players[1]],
    });
    expect(noPick.ok).toBe(false);
    expect(noPick.message).toContain('石镐');

    const withPick = craftDove({
      ...first.state,
      players: [
        { ...first.state.players[0], inventory: { crafting_table: 1, stone_pickaxe: 1 } },
        first.state.players[1],
      ],
    });
    expect(withPick.ok).toBe(true);
    expect(countOf(withPick.state.players[0].inventory, 'stone_pickaxe')).toBe(0);

    // 第三只：需要工作台 + 铁剑
    const noSword = craftDove({
      ...withPick.state,
      players: [{ ...withPick.state.players[0], inventory: { crafting_table: 1 } }, withPick.state.players[1]],
    });
    expect(noSword.ok).toBe(false);
    expect(noSword.message).toContain('铁剑');

    const withSword = craftDove({
      ...withPick.state,
      players: [
        { ...withPick.state.players[0], inventory: { crafting_table: 1, iron_sword: 1 } },
        withPick.state.players[1],
      ],
    });
    expect(withSword.ok).toBe(true);
    expect(countOf(withSword.state.players[0].inventory, 'iron_sword')).toBe(0);
  });

  it('超过上限后拒绝孵化', () => {
    const state = stateWith({});
    state.players[0].dovesMade = 3;
    const result = craftDove(state);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('上限');
  });
});
