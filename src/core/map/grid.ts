import type { Coord, GameMap, TileKind } from '../types';

export function indexOf(x: number, y: number, width: number): number {
  return y * width + x;
}

export function coordOf(index: number, width: number): Coord {
  const x = index % width;
  return { x, y: (index - x) / width };
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** 仅正交相邻触发交互；斜角返回 false。 */
export function isOrthogonallyAdjacent(a: Coord, b: Coord): boolean {
  return manhattan(a, b) === 1;
}

const DIRS: readonly Coord[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

export function orthogonalNeighbors(x: number, y: number, width: number, height: number): Coord[] {
  const out: Coord[] = [];
  for (const d of DIRS) {
    const nx = x + d.x;
    const ny = y + d.y;
    if (inBounds(nx, ny, width, height)) out.push({ x: nx, y: ny });
  }
  return out;
}

export function tileAt(map: GameMap, x: number, y: number): TileKind | null {
  if (!inBounds(x, y, map.width, map.height)) return null;
  return map.tiles[indexOf(x, y, map.width)] ?? null;
}

export function setTile(map: GameMap, x: number, y: number, kind: TileKind): void {
  map.tiles[indexOf(x, y, map.width)] = kind;
}

export function countTiles(map: GameMap, kind: TileKind): number {
  return map.tiles.filter((t) => t === kind).length;
}

/**
 * 广度优先距离，单位是步数。所有格子均可通行（资源不阻挡），
 * 因此结果等价于曼哈顿距离；仍用 BFS 实现，便于未来加入障碍物。
 */
export function bfsDistances(map: GameMap, from: Coord): number[] {
  const { width, height } = map;
  const dist = new Array<number>(width * height).fill(-1);
  const startIndex = indexOf(from.x, from.y, width);
  dist[startIndex] = 0;
  const queue: number[] = [startIndex];
  for (let head = 0; head < queue.length; head += 1) {
    const cur = queue[head] as number;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    for (const d of DIRS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!inBounds(nx, ny, width, height)) continue;
      const ni = indexOf(nx, ny, width);
      if (dist[ni] !== -1) continue;
      dist[ni] = (dist[cur] as number) + 1;
      queue.push(ni);
    }
  }
  return dist;
}
