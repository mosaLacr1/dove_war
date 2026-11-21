import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/config/balance';
import { RESOURCE_LIST } from '../src/core/config/items';
import { generateMap } from '../src/core/map/generate';
import { analyzeMap, validateMap } from '../src/core/map/validate';
import { indexOf } from '../src/core/map/grid';

const W = BALANCE.map.width;
const H = BALANCE.map.height;

describe('地图生成', () => {
  it('固定为 10 行 × 16 列', () => {
    const map = generateMap('SIZE');
    expect(map.width).toBe(16);
    expect(map.height).toBe(10);
    expect(map.tiles).toHaveLength(W * H);
  });

  it('同一种子生成完全相同的地图（可复现）', () => {
    const a = generateMap('DOVE-ABC123');
    const b = generateMap('DOVE-ABC123');
    expect(a.tiles).toEqual(b.tiles);
    expect(a.seed).toBe(b.seed);
  });

  it('不同种子生成不同地图', () => {
    const a = generateMap('DOVE-AAA111');
    const b = generateMap('DOVE-BBB222');
    expect(a.tiles).not.toEqual(b.tiles);
  });

  it('左右镜像对称：每一格都与对侧同格相同', () => {
    for (const seed of ['SYM-1', 'SYM-2', 'SYM-3']) {
      const map = generateMap(seed);
      for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < W; x += 1) {
          expect(map.tiles[indexOf(x, y, W)]).toBe(map.tiles[indexOf(W - 1 - x, y, W)]);
        }
      }
    }
  });

  it('五种资源齐全，且出生点为空地', () => {
    const map = generateMap('KINDS');
    const facts = analyzeMap(map);
    expect(facts.missingKinds).toEqual([]);
    expect(facts.spawnClear).toBe(true);
    expect(facts.kinds).toHaveLength(RESOURCE_LIST.length);
  });

  it('双方开局资源完全一致（公平性）', () => {
    const map = generateMap('FAIR');
    const facts = analyzeMap(map);
    expect(facts.sides[0]).toEqual(facts.sides[1]);
    expect(facts.sides[0].woodNear).toBeGreaterThanOrEqual(BALANCE.map.woodCount);
    expect(facts.sides[0].stoneNear).toBeGreaterThanOrEqual(BALANCE.map.stoneCount);
    expect(facts.sides[0].nearestIron).toBeLessThanOrEqual(BALANCE.map.ironMaxDist);
  });

  it('1000 个随机种子全部通过校验（含开局可行性与连通性）', () => {
    for (let i = 0; i < 1000; i += 1) {
      const map = generateMap(`STRESS-${i}`);
      const validation = validateMap(map);
      expect(validation.ok, `种子 STRESS-${i}: ${validation.problems.join('；')}`).toBe(true);
      expect(map.attempts).toBe(0);
    }
  });

  it('所有资源格都能从双方出生点走到', () => {
    const map = generateMap('REACH');
    expect(analyzeMap(map).resourcesReachable).toBe(true);
  });

  it('资源比上一版更富裕：整幅地图的资源格占比明显提高', () => {
    for (const seed of ['DENS-1', 'DENS-2', 'DENS-3']) {
      const map = generateMap(seed);
      const resources = map.tiles.filter((t) => t !== 'empty').length;
      expect(resources).toBeGreaterThanOrEqual(70);
      expect(resources / (W * H)).toBeGreaterThan(0.42);
    }
  });

  it('每种资源在整幅地图上都有足够的数量', () => {
    const map = generateMap('QUOTA');
    const counts = new Map<string, number>();
    for (const tile of map.tiles) {
      if (tile === 'empty') continue;
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
    expect(counts.get('wood') ?? 0).toBeGreaterThanOrEqual(BALANCE.map.quotas.wood * 2);
    expect(counts.get('stone') ?? 0).toBeGreaterThanOrEqual(BALANCE.map.quotas.stone * 2);
    expect(counts.get('raw_iron_block') ?? 0).toBeGreaterThanOrEqual(BALANCE.map.quotas.raw_iron_block * 2);
    expect(counts.get('gold_block') ?? 0).toBeGreaterThanOrEqual(BALANCE.map.quotas.gold_block * 2);
    expect(counts.get('diamond') ?? 0).toBeGreaterThanOrEqual(BALANCE.map.quotas.diamond * 2);
  });
});
