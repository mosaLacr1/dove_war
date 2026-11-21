/**
 * 确定性随机数：同一 seed 在任何机器、任何时刻都产生同一序列。
 * 游戏内所有随机（地图、决斗 AI）都必须经过这里，禁止 Math.random()。
 */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** 把字符串种子压成 32 位整数（FNV-1a）。 */
export function hashSeed(input: string | number): number {
  if (typeof input === 'number') return (input >>> 0) || 1;
  let h = FNV_OFFSET;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return (h >>> 0) || 1;
}

/** mulberry32 的单步推进，返回新状态与 [0,1) 采样值。 */
export function nextRandom(state: number): { state: number; value: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: s, value };
}

/** 有状态随机源，仅供生成阶段与 UI 使用；游戏状态里保存的是裸 state。 */
export class Rng {
  private state: number;

  constructor(seed: string | number) {
    this.state = hashSeed(seed);
  }

  next(): number {
    const r = nextRandom(this.state);
    this.state = r.state;
    return r.value;
  }

  /** 闭区间整数 [min, max]。 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick 收到空数组');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** 原地洗牌并返回同一数组，Fisher–Yates。 */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = items[i] as T;
      items[i] = items[j] as T;
      items[j] = tmp;
    }
    return items;
  }

  get stateValue(): number {
    return this.state;
  }

  set stateValue(v: number) {
    this.state = v >>> 0;
  }
}

const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 生成一个便于口头传播的对局种子，例如 `DOVE-7K3M2Q`。 */
export function randomSeed(): string {
  const rng = new Rng(`${Date.now()}-${Math.floor(Math.random() * 1e9)}`);
  let tail = '';
  for (let i = 0; i < 6; i += 1) tail += SEED_ALPHABET[rng.int(0, SEED_ALPHABET.length - 1)];
  return `DOVE-${tail}`;
}
