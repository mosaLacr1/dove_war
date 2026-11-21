import { BALANCE } from '../config/balance';
import { Rng } from '../rng';
import type { Coord, GameMap, PlayerId, TileKind } from '../types';
import { bfsDistances, indexOf } from './grid';
import { validateMap } from './validate';

const W = BALANCE.map.width;
const H = BALANCE.map.height;

/** 生成布局使用的左半区列数（含中缝列 5）；右半区由镜像得到。 */
const LEFT_COLUMNS = W / 2;

export function spawnOf(player: PlayerId): Coord {
  const s = BALANCE.map.spawn[player];
  return { x: s.x, y: s.y };
}

/**
 * 生成一版候选地图（未校验）。布局策略：
 * 1. 只生成左半边，右半边按 x → W-1-x 镜像，天然保证公平；
 * 2. 用配额填充保证「开局不卡死」：近身木头、近身石头、可达生铁；
 * 3. 中缝列放置稀有资源（钻石/金）作为争夺目标。
 */
export function buildCandidate(seed: string, attempt: number): GameMap {
  const rng = new Rng(`${seed}#map#${attempt}`);
  const tiles: TileKind[] = new Array<TileKind>(W * H).fill('empty');
  const spawn = spawnOf(0);

  const scratch: GameMap = { width: W, height: H, tiles, seed, attempts: attempt, valid: false };
  const dist = bfsDistances(scratch, spawn);
  const distOf = (c: Coord): number => dist[indexOf(c.x, c.y, W)] as number;

  const leftCells: Coord[] = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < LEFT_COLUMNS; x += 1) {
      if (x === spawn.x && y === spawn.y) continue;
      leftCells.push({ x, y });
    }
  }

  const used = new Set<number>();
  const take = (pool: Coord[], n: number): Coord[] => {
    const free = rng.shuffle(pool.filter((c) => !used.has(indexOf(c.x, c.y, W))));
    const picked = free.slice(0, n);
    for (const c of picked) used.add(indexOf(c.x, c.y, W));
    return picked;
  };
  const put = (cells: Coord[], kind: TileKind): void => {
    for (const c of cells) tiles[indexOf(c.x, c.y, W)] = kind;
  };

  const quota = BALANCE.map.quotas;
  const fill = BALANCE.map.fillChance;

  // 近身节奏：1 步内先给 2 块木头，2 步内补齐剩下的（满足「2 步内 ≥4 木头」）。
  const nearWood = Math.min(quota.wood, 2);
  put(take(leftCells.filter((c) => distOf(c) === 1), nearWood), 'wood');
  put(take(leftCells.filter((c) => distOf(c) === 2), Math.max(0, quota.wood - nearWood)), 'wood');

  // 3 步内 10 块石头（木镐即可采，构成第一段工具链）。
  put(take(leftCells.filter((c) => distOf(c) >= 1 && distOf(c) <= 3), quota.stone), 'stone');

  // 生铁块：4~8 步，满足「10 步内可达」。
  put(take(leftCells.filter((c) => distOf(c) >= 4 && distOf(c) <= 8), quota.raw_iron_block), 'raw_iron_block');

  // 金块：更远一些，作为中期目标。
  put(take(leftCells.filter((c) => distOf(c) >= 5), quota.gold_block), 'gold_block');

  // 钻石：靠近地图中央（列 7，镜像后为列 8），需要铁镐，作为争夺目标。
  put(take(leftCells.filter((c) => c.x === LEFT_COLUMNS - 1 && distOf(c) >= 4), quota.diamond), 'diamond');

  // 额外随机填充：整体资源比上一版更富裕。
  for (const c of leftCells) {
    const i = indexOf(c.x, c.y, W);
    if (used.has(i)) continue;
    const r = rng.next();
    if (r < fill.stone) tiles[i] = 'stone';
    else if (r < fill.stone + fill.wood) tiles[i] = 'wood';
    else if (r < fill.stone + fill.wood + fill.raw_iron_block) tiles[i] = 'raw_iron_block';
  }

  // 镜像到右半边。
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < LEFT_COLUMNS; x += 1) {
      tiles[indexOf(W - 1 - x, y, W)] = tiles[indexOf(x, y, W)] as TileKind;
    }
  }

  return { width: W, height: H, tiles, seed, attempts: attempt, valid: false };
}

/**
 * 生成 + 校验。校验不通过就换一个 salt 重试。
 * 配额式构造保证约束必然成立，重试是给未来改动留的安全网。
 */
export function generateMap(seed: string): GameMap {
  let last = buildCandidate(seed, 0);
  for (let attempt = 0; attempt < BALANCE.map.maxAttempts; attempt += 1) {
    const candidate = attempt === 0 ? last : buildCandidate(seed, attempt);
    candidate.attempts = attempt;
    const validation = validateMap(candidate);
    candidate.valid = validation.ok;
    if (validation.ok) return candidate;
    last = candidate;
  }
  return last;
}
