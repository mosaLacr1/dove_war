import { BALANCE } from '../config/balance';
import { RESOURCE_LIST } from '../config/items';
import type { Coord, GameMap, ResourceKind } from '../types';
import { bfsDistances, indexOf, tileAt } from './grid';

export interface SideFacts {
  /** 出生点附近（≤ woodRadius）的木头数量。 */
  woodNear: number;
  /** 出生点附近（≤ stoneRadius）的石头数量。 */
  stoneNear: number;
  /** 出生点到最近生铁块的步数，-1 表示没有。 */
  nearestIron: number;
}

export interface MapFacts {
  sizeOk: boolean;
  symmetric: boolean;
  kinds: ResourceKind[];
  missingKinds: ResourceKind[];
  spawnClear: boolean;
  sides: [SideFacts, SideFacts];
  /** 所有资源格都能从双方出生点走到（BFS 证明）。 */
  resourcesReachable: boolean;
  resourceTiles: number;
}

export interface MapValidation {
  ok: boolean;
  problems: string[];
  facts: MapFacts;
}

function analyzeSide(map: GameMap, spawn: Coord): SideFacts {
  const { width } = map;
  const dist = bfsDistances(map, spawn);
  let woodNear = 0;
  let stoneNear = 0;
  let nearestIron = -1;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = dist[indexOf(x, y, width)] as number;
      if (d < 0) continue;
      const tile = map.tiles[indexOf(x, y, width)];
      if (tile === 'wood' && d <= BALANCE.map.woodRadius) woodNear += 1;
      if (tile === 'stone' && d <= BALANCE.map.stoneRadius) stoneNear += 1;
      if (tile === 'raw_iron_block' && (nearestIron === -1 || d < nearestIron)) nearestIron = d;
    }
  }
  return { woodNear, stoneNear, nearestIron };
}

export function analyzeMap(map: GameMap): MapFacts {
  const { width, height } = map;
  const sizeOk = width === BALANCE.map.width && height === BALANCE.map.height;

  let symmetric = true;
  for (let y = 0; y < height && symmetric; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (map.tiles[indexOf(x, y, width)] !== map.tiles[indexOf(width - 1 - x, y, width)]) {
        symmetric = false;
        break;
      }
    }
  }

  const present = new Set<ResourceKind>();
  for (const tile of map.tiles) {
    if (tile !== 'empty') present.add(tile);
  }
  const kinds = RESOURCE_LIST.map((r) => r.kind).filter((k) => present.has(k));
  const missingKinds = RESOURCE_LIST.map((r) => r.kind).filter((k) => !present.has(k));

  const spawns = [BALANCE.map.spawn[0], BALANCE.map.spawn[1]] as const;
  const spawnClear = spawns.every((s) => tileAt(map, s.x, s.y) === 'empty');

  const sides: [SideFacts, SideFacts] = [
    analyzeSide(map, { x: spawns[0].x, y: spawns[0].y }),
    analyzeSide(map, { x: spawns[1].x, y: spawns[1].y }),
  ];

  // 连通性：所有资源格必须能从两个出生点分别走到。
  const reach = spawns.map((s) => bfsDistances(map, { x: s.x, y: s.y }));
  let resourcesReachable = true;
  let resourceTiles = 0;
  for (let i = 0; i < map.tiles.length; i += 1) {
    if (map.tiles[i] === 'empty') continue;
    resourceTiles += 1;
    for (const dist of reach) {
      if ((dist[i] as number) < 0) resourcesReachable = false;
    }
  }

  return { sizeOk, symmetric, kinds, missingKinds, spawnClear, sides, resourcesReachable, resourceTiles };
}

export function validateMap(map: GameMap): MapValidation {
  const facts = analyzeMap(map);
  const problems: string[] = [];

  if (!facts.sizeOk) problems.push(`地图尺寸必须为 ${BALANCE.map.width}×${BALANCE.map.height}`);
  if (!facts.symmetric) problems.push('地图不满足左右镜像对称');
  if (!facts.spawnClear) problems.push('出生点被资源占用');
  if (!facts.resourcesReachable) problems.push('存在无法到达的资源格');
  if (facts.resourceTiles === 0) problems.push('地图没有任何资源');
  if (facts.missingKinds.length > 0) {
    problems.push(`缺少资源类型：${facts.missingKinds.join(', ')}`);
  }

  facts.sides.forEach((side, i) => {
    const label = `玩家 ${i + 1}`;
    if (side.woodNear < BALANCE.map.woodCount) {
      problems.push(`${label} 出生点 ${BALANCE.map.woodRadius} 步内木头不足（${side.woodNear}/${BALANCE.map.woodCount}）`);
    }
    if (side.stoneNear < BALANCE.map.stoneCount) {
      problems.push(`${label} 出生点 ${BALANCE.map.stoneRadius} 步内石头不足（${side.stoneNear}/${BALANCE.map.stoneCount}）`);
    }
    if (side.nearestIron < 0 || side.nearestIron > BALANCE.map.ironMaxDist) {
      problems.push(`${label} 出生点无法在 ${BALANCE.map.ironMaxDist} 步内抵达生铁块`);
    }
  });

  const [a, b] = facts.sides;
  if (a.woodNear !== b.woodNear || a.stoneNear !== b.stoneNear || a.nearestIron !== b.nearestIron) {
    problems.push('双方开局资源分布不公平（镜像被破坏）');
  }

  return { ok: problems.length === 0, problems, facts };
}
