import { BALANCE, type PlatformDef } from '../config/balance';
import { DIFFICULTIES, type DuelAiProfile } from '../config/difficulty';
import { Rng } from '../rng';
import type { AiIntent, DuelInput, FighterState } from './types';
import { NO_INPUT } from './types';

const D = BALANCE.duel;
const PLATFORMS: readonly PlatformDef[] = D.platforms;
/** 一跳能上升的最大高度（留一点余量）。 */
const JUMP_HEIGHT = (D.physics.jumpVelocity * D.physics.jumpVelocity) / (2 * D.physics.gravity) - 14;

/**
 * 决斗 AI：只依赖固定步长下的模拟状态、难度档案与自己的种子随机流，
 * 因此「同种子 + 同玩家输入 + 同难度」必然复现同一场战斗。
 */
export class DuelAi {
  private rng: Rng;
  private profile: DuelAiProfile;
  private intent: AiIntent = 'approach';
  private intentTtl = 0;
  private decideIn = 0;
  private fireAttack = false;
  private fireDash = false;
  /** 走位参照点：跳到某块平台时以平台中心为准，否则以对手为准。 */
  private targetX: number | null = null;

  constructor(seed: string | number, profile: DuelAiProfile = DIFFICULTIES.normal.duel) {
    this.rng = new Rng(seed);
    this.profile = profile;
  }

  decide(self: FighterState, opponent: FighterState, dt: number): DuelInput {
    this.decideIn -= dt;
    this.intentTtl -= dt;

    if (this.decideIn <= 0 || this.intentTtl <= 0) {
      this.decideIn = this.profile.reactionSec;
      this.choose(self, opponent);
    }

    const anchorX = this.targetX ?? opponent.x;
    const dir = anchorX >= self.x ? 1 : -1;
    const input: DuelInput = { ...NO_INPUT, aimX: opponent.x };

    switch (this.intent) {
      case 'approach':
        if (dir > 0) input.right = true;
        else input.left = true;
        break;
      case 'retreat':
        if (dir > 0) input.left = true;
        else input.right = true;
        break;
      case 'attack':
        if (dir > 0) input.right = true;
        else input.left = true;
        break;
      case 'block':
        input.block = true;
        break;
      case 'dash':
        // 向后闪避；冲刺方向由移动输入决定。
        if (dir > 0) input.left = true;
        else input.right = true;
        break;
      case 'jump':
        // 按住跳跃键才能跳满高度（模拟器有松键截断）
        input.jump = true;
        if (dir > 0) input.right = true;
        else input.left = true;
        break;
      default:
        break;
    }

    if (this.fireAttack) {
      input.attack = true;
      this.fireAttack = false;
    }
    if (this.fireDash) {
      input.dash = true;
      this.fireDash = false;
    }
    return input;
  }

  private choose(self: FighterState, opponent: FighterState): void {
    const p = this.profile;
    const { attack } = D;
    const dx = opponent.x - self.x;
    const dist = Math.abs(dx);
    const dy = opponent.y - self.y;
    const heightGap = Math.abs(dy);
    const lowHp = self.hp / self.maxHp < p.lowHpRatio;
    const setIntent = (intent: AiIntent, ttl: number): void => {
      this.intent = intent;
      this.intentTtl = ttl;
    };
    const strike = (): void => {
      setIntent('attack', 0.15);
      this.fireAttack = true;
    };

    this.targetX = null;

    // 对手在上方
    if (dy < -48) {
      if (!p.jumpToPlatforms) {
        // 不会跳台：只能横向拉开，等对手下来
        setIntent('retreat', 0.35);
        return;
      }
      if (self.onGround) {
        const platform = this.pickPlatformAbove(self);
        if (platform) {
          const center = (platform.x1 + platform.x2) / 2;
          this.targetX = center;
          if (Math.abs(center - self.x) < 26) {
            setIntent('jump', 0.26);
            return;
          }
          setIntent('approach', 0.18);
          return;
        }
        setIntent('jump', 0.26);
        return;
      }
      if (dist < attack.reach && heightGap < attack.verticalReach) {
        strike();
        return;
      }
      setIntent('approach', 0.12);
      return;
    }

    // 对手明显在下方：先降到同一层再打
    if (dy > attack.verticalReach) {
      setIntent('approach', 0.2);
      return;
    }

    // 对手起手：考虑盾反 / 格挡 / 闪避 / 对拼
    if (opponent.mode === 'windup' && dist < attack.reach + 24 && heightGap < attack.verticalReach) {
      // 盾反：在对手即将命中的瞬间按下格挡
      if (
        self.shield &&
        !self.blocking &&
        self.onGround &&
        opponent.modeTimer < 0.09 &&
        this.rng.next() < p.parrySkill
      ) {
        setIntent('block', 0.22);
        return;
      }
      const roll = this.rng.next();
      if (roll < p.blockChance && self.onGround && self.stamina > 30) {
        setIntent('block', 0.28);
        return;
      }
      if (roll < p.blockChance + p.dashChance) {
        if (self.onGround && this.rng.chance(0.5)) setIntent('jump', 0.24);
        else {
          setIntent('dash', 0.2);
          this.fireDash = true;
        }
        return;
      }
      if (roll < p.blockChance + p.dashChance + p.jumpChance) {
        setIntent('jump', 0.24);
        return;
      }
      if (roll < p.blockChance + p.dashChance + p.jumpChance + p.aggression * 0.5) {
        strike();
        return;
      }
      setIntent('retreat', 0.25);
      return;
    }

    if (lowHp && self.stamina < 40 && dist < 150) {
      setIntent('retreat', 0.45);
      return;
    }

    if (dist > 100 || heightGap > attack.verticalReach) {
      setIntent('approach', 0.25);
      return;
    }

    if (dist < 55) {
      if (this.rng.chance(0.45)) setIntent('retreat', 0.22);
      else strike();
      return;
    }

    if (self.attackCooldown <= 0) {
      strike();
      return;
    }

    setIntent('approach', 0.18);
  }

  /** 找一块在跳跃高度内、位于头顶上方的平台。 */
  private pickPlatformAbove(self: FighterState): PlatformDef | null {
    let best: PlatformDef | null = null;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const platform of PLATFORMS) {
      const rise = self.y - platform.y;
      if (rise < 20 || rise > JUMP_HEIGHT) continue;
      const center = (platform.x1 + platform.x2) / 2;
      const cost = Math.abs(center - self.x);
      if (cost < bestCost) {
        bestCost = cost;
        best = platform;
      }
    }
    return best;
  }
}
