import { BALANCE, type PlatformDef } from '../config/balance';
import type { DuelAiProfile } from '../config/difficulty';
import type { DuelFighterInit, DuelResult } from '../types';
import { DuelAi } from './ai';
import { NO_INPUT } from './types';
import type { DuelInput, FighterState, FighterView } from './types';

export type DuelSide = 'left' | 'right';

export interface DuelOptions {
  seed: string | number;
  left: DuelFighterInit;
  right: DuelFighterInit;
  /** 哪一个（或两个）由 AI 接管；留空表示双人同屏。 */
  aiSides?: DuelSide[];
  durationSec?: number;
  /** 难度档案：决定 AI 的反应、格挡与盾反水平。 */
  aiProfile?: DuelAiProfile;
}

export interface DuelEffect {
  kind: 'hit' | 'block' | 'guard' | 'dodge' | 'ko' | 'jump' | 'land' | 'parry' | 'counter';
  x: number;
  y: number;
  life: number;
  damage: number;
}

export interface DuelSnapshot {
  elapsed: number;
  timeLeft: number;
  fighters: [FighterView, FighterView];
  result: DuelResult | null;
  effects: DuelEffect[];
  /** 命中抖屏强度，UI 用来做镜头偏移。 */
  shake: number;
}

const D = BALANCE.duel;
const GROUND = D.arena.groundY;
const PLATFORMS: readonly PlatformDef[] = D.platforms;
const P = D.physics;

function makeFighter(init: DuelFighterInit, side: DuelSide): FighterState {
  return {
    unitId: init.unitId,
    owner: init.owner,
    x: side === 'left' ? D.startX.left : D.startX.right,
    y: GROUND,
    vx: 0,
    vy: 0,
    facing: side === 'left' ? 1 : -1,
    onGround: true,
    hp: init.maxHp,
    maxHp: init.maxHp,
    stamina: D.stamina.max,
    damage: init.damage,
    reduction: init.reduction,
    mode: 'idle',
    modeTimer: 0,
    attackCooldown: 0,
    dashCooldown: 0,
    invuln: 0,
    blocking: false,
    hitFlash: 0,
    dashDir: side === 'left' ? 1 : -1,
    coyote: 0,
    jumpBuffer: 0,
    shield: init.shield,
    parryTimer: 0,
    parryCooldown: 0,
  };
}

function view(f: FighterState): FighterView {
  return {
    unitId: f.unitId,
    owner: f.owner,
    x: f.x,
    y: f.y,
    facing: f.facing,
    hp: f.hp,
    maxHp: f.maxHp,
    stamina: f.stamina,
    mode: f.mode,
    blocking: f.blocking,
    invulnerable: f.invuln > 0,
    onGround: f.onGround,
    hitFlash: f.hitFlash,
    shield: f.shield,
    parryReady: f.parryTimer > 0 && f.parryCooldown <= 0,
  };
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

function overlapsPlatform(x: number, p: PlatformDef): boolean {
  return x + D.bodyHalfWidth > p.x1 && x - D.bodyHalfWidth < p.x2;
}

export class DuelSim {
  private readonly durationSec: number;
  private readonly fighters: [FighterState, FighterState];
  private readonly ai: { left: DuelAi | null; right: DuelAi | null };
  private readonly prev: { left: DuelInput; right: DuelInput } = { left: NO_INPUT, right: NO_INPUT };
  private elapsed = 0;
  private result: DuelResult | null = null;
  private effects: DuelEffect[] = [];
  private hitStop = 0;
  private shake = 0;

  constructor(opts: DuelOptions) {
    this.durationSec = opts.durationSec ?? D.durationSec;
    this.fighters = [makeFighter(opts.left, 'left'), makeFighter(opts.right, 'right')];
    const aiSides = opts.aiSides ?? [];
    this.ai = {
      left: aiSides.includes('left') ? new DuelAi(`${opts.seed}#ai-left`, opts.aiProfile) : null,
      right: aiSides.includes('right') ? new DuelAi(`${opts.seed}#ai-right`, opts.aiProfile) : null,
    };
  }

  get finished(): boolean {
    return this.result !== null;
  }

  get finalResult(): DuelResult | null {
    return this.result;
  }

  get timeLeft(): number {
    return Math.max(0, this.durationSec - this.elapsed);
  }

  /** 推进一个固定步长。humanInput 只作用于非 AI 的一方（PvE 下即玩家）。 */
  step(dtRaw: number, humanInput: DuelInput = NO_INPUT): void {
    this.advanceFrame(dtRaw, humanInput, humanInput);
  }

  /** 双人同屏 / 测试用：左右两侧分别给输入。 */
  stepBoth(dtRaw: number, leftInput: DuelInput, rightInput: DuelInput): void {
    this.advanceFrame(dtRaw, leftInput, rightInput);
  }

  private advanceFrame(dtRaw: number, leftHuman: DuelInput, rightHuman: DuelInput): void {
    if (this.result) return;
    const dt = Math.min(Math.max(dtRaw, 0), 1 / 20);

    // 命中顿帧：冻结模拟但保留特效淡出，打击感更"实"。
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.shake = Math.max(0, this.shake - D.shakeDecayPerSec * dt);
      this.decayEffects(dt);
      return;
    }

    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - D.shakeDecayPerSec * dt);

    const inputs: { left: DuelInput; right: DuelInput } = {
      left: this.ai.left ? this.ai.left.decide(this.fighters[0], this.fighters[1], dt) : leftHuman,
      right: this.ai.right ? this.ai.right.decide(this.fighters[1], this.fighters[0], dt) : rightHuman,
    };

    if (this.fighters[0].mode !== 'ko') this.advance(this.fighters[0], this.fighters[1], inputs.left, this.prev.left, dt);
    if (this.fighters[1].mode !== 'ko') this.advance(this.fighters[1], this.fighters[0], inputs.right, this.prev.right, dt);

    this.prev.left = inputs.left;
    this.prev.right = inputs.right;

    this.separate();
    this.decayEffects(dt);
    this.checkOutcome();
  }

  getSnapshot(): DuelSnapshot {
    return {
      elapsed: this.elapsed,
      timeLeft: this.timeLeft,
      fighters: [view(this.fighters[0]), view(this.fighters[1])],
      result: this.result,
      effects: this.effects.map((e) => ({ ...e })),
      shake: this.shake,
    };
  }

  getFighter(unitId: string): FighterView | null {
    const f = this.fighters.find((x) => x.unitId === unitId);
    return f ? view(f) : null;
  }

  private advance(f: FighterState, other: FighterState, input: DuelInput, prev: DuelInput, dt: number): void {
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    f.dashCooldown = Math.max(0, f.dashCooldown - dt);
    f.invuln = Math.max(0, f.invuln - dt);
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    f.modeTimer -= dt;
    f.coyote = f.onGround ? P.coyoteSec : Math.max(0, f.coyote - dt);
    f.jumpBuffer = Math.max(0, f.jumpBuffer - dt);

    // 0. 完美格挡窗口：按下格挡的瞬间开启，只有一瞬
    f.parryTimer = Math.max(0, f.parryTimer - dt);
    f.parryCooldown = Math.max(0, f.parryCooldown - dt);
    if (input.block && !prev.block && f.parryCooldown <= 0) {
      f.parryTimer = D.parry.windowSec;
    }

    // 1. 格挡意图（只能站在地面上举盾）
    const canGuard = f.onGround && (f.mode === 'idle' || f.mode === 'block');
    if (canGuard && input.block && f.stamina > 0) {
      f.mode = 'block';
      f.blocking = true;
    } else if (f.mode === 'block') {
      f.mode = 'idle';
      f.blocking = false;
    }

    // 2. 动作阶段推进
    switch (f.mode) {
      case 'windup':
        if (f.modeTimer <= 0) {
          f.mode = 'strike';
          f.modeTimer = D.attack.strikeSec;
          this.resolveStrike(f, other);
        }
        break;
      case 'strike':
        if (f.modeTimer <= 0) {
          f.mode = 'recover';
          f.modeTimer = D.attack.recoverSec;
        }
        break;
      case 'recover':
        if (f.modeTimer <= 0) f.mode = 'idle';
        break;
      case 'hurt':
        if (f.modeTimer <= 0) {
          f.mode = 'idle';
          f.vx = 0;
        }
        break;
      case 'dash':
        if (f.modeTimer <= 0) f.mode = 'idle';
        break;
      default:
        break;
    }

    // 3. 跳跃（带缓冲与土狼时间，落地前提前按也能起跳）
    if (input.jump && !prev.jump) f.jumpBuffer = P.jumpBufferSec;
    const canJump = f.mode !== 'hurt' && f.mode !== 'dash';
    if (f.jumpBuffer > 0 && canJump && (f.onGround || f.coyote > 0)) {
      f.vy = P.jumpVelocity;
      f.onGround = false;
      f.coyote = 0;
      f.jumpBuffer = 0;
      this.pushEffect('jump', f.x, f.y, 0);
    }

    // 松键截断跳跃高度：轻点小跳，按住高跳
    if (!input.jump && f.vy < P.jumpVelocity * 0.35) {
      f.vy = P.jumpVelocity * 0.35;
    }

    // 4. 起手 / 冲刺（上升沿触发）
    const canAct = f.mode === 'idle' || f.mode === 'block';
    if (canAct) {
      if (input.attack && !prev.attack && f.attackCooldown <= 0) {
        f.mode = 'windup';
        f.modeTimer = D.attack.windupSec;
        f.attackCooldown = D.attack.cooldownSec;
        f.blocking = false;
        // 前冲半步，让出手更有推进感
        f.vx += f.facing * 70;
      } else if (input.dash && !prev.dash && f.dashCooldown <= 0 && f.stamina >= D.dash.staminaCost) {
        f.mode = 'dash';
        f.modeTimer = D.dash.durationSec;
        f.invuln = D.dash.durationSec;
        f.dashCooldown = D.dash.cooldownSec;
        f.stamina -= D.dash.staminaCost;
        f.blocking = false;
        f.dashDir = input.left ? -1 : input.right ? 1 : f.facing;
        this.pushEffect('jump', f.x, f.y, 0);
      }
    }

    // 5. 朝向：出手/冲刺/受击期间锁定，其余时间跟随鼠标（没给瞄准点就自动面向对手）
    const facingLocked =
      f.mode === 'dash' || f.mode === 'windup' || f.mode === 'strike' || f.mode === 'hurt';
    if (!facingLocked) {
      const aim = input.aimX;
      if (aim !== null && Math.abs(aim - f.x) > 10) {
        f.facing = aim > f.x ? 1 : -1;
      } else {
        const dx = other.x - f.x;
        if (Math.abs(dx) > 1) f.facing = dx > 0 ? 1 : -1;
      }
    }

    // 6. 水平速度：加速度 + 摩擦，起步与急停都更干脆
    const speed = f.blocking ? P.blockSpeed : f.onGround ? P.groundSpeed : P.airSpeed;
    const accel = f.onGround ? P.accel : P.airAccel;
    let dir = 0;
    if (input.left) dir -= 1;
    if (input.right) dir += 1;

    if (f.mode === 'dash') {
      f.vx = f.dashDir * D.dash.speed;
    } else if (f.mode === 'idle' || f.mode === 'block') {
      f.vx = dir !== 0 ? approach(f.vx, dir * speed, accel * dt) : approach(f.vx, 0, P.friction * dt);
    } else if (f.mode === 'hurt') {
      f.vx = approach(f.vx, 0, P.friction * 0.35 * dt);
    } else {
      f.vx = approach(f.vx, 0, P.friction * dt);
    }

    f.x += f.vx * dt;
    f.x = Math.max(D.arena.minX, Math.min(D.arena.maxX, f.x));

    // 7. 垂直：重力、单向平台、落地
    const prevY = f.y;
    if (!f.onGround) {
      f.vy = Math.min(f.vy + P.gravity * dt, P.maxFallSpeed);
      f.y += f.vy * dt;
    } else {
      f.vy = 0;
      const support = this.supportAt(f);
      if (support === null) {
        // 走出平台边缘
        f.onGround = false;
      } else {
        f.y = support;
      }
    }

    if (!f.onGround && f.vy >= 0) {
      const landing = this.landingAt(f, prevY, f.y);
      if (landing !== null) {
        f.y = landing;
        f.vy = 0;
        f.onGround = true;
        this.pushEffect('land', f.x, f.y, 0);
      }
    }

    // 8. 耐力
    if (f.blocking) {
      f.stamina -= D.block.staminaDrainPerSec * dt;
      if (f.stamina <= 0) {
        f.stamina = 0;
        f.blocking = false;
        f.mode = 'hurt';
        f.modeTimer = D.block.guardBreakSec;
      }
    } else if (f.mode === 'idle' || f.mode === 'recover') {
      f.stamina = Math.min(D.stamina.max, f.stamina + D.stamina.regenPerSec * dt);
    }
  }

  private supportAt(f: FighterState): number | null {
    if (Math.abs(f.y - GROUND) < 0.5) return GROUND;
    for (const p of PLATFORMS) {
      if (Math.abs(f.y - p.y) < 1 && overlapsPlatform(f.x, p)) return p.y;
    }
    return null;
  }

  private landingAt(f: FighterState, prevY: number, nextY: number): number | null {
    for (const p of PLATFORMS) {
      if (!overlapsPlatform(f.x, p)) continue;
      if (prevY <= p.y + 0.5 && nextY >= p.y) return p.y;
    }
    if (nextY >= GROUND) return GROUND;
    return null;
  }

  private resolveStrike(attacker: FighterState, defender: FighterState): void {
    const dx = defender.x - attacker.x;
    const dist = Math.abs(dx);
    const inFront = dist < 1 || Math.sign(dx) === attacker.facing;
    const dy = Math.abs(defender.y - attacker.y);

    if (!inFront || dist > D.attack.reach || dy > D.attack.verticalReach) {
      this.pushEffect('dodge', attacker.x + attacker.facing * 40, attacker.y - 70, 0);
      return;
    }

    if (defender.invuln > 0) {
      this.pushEffect('dodge', defender.x, defender.y - 90, 0);
      return;
    }

    const contactX = (attacker.x + defender.x) / 2;
    const contactY = (attacker.y + defender.y) / 2 - 60;

    // 完美格挡 / 盾反：在按下格挡的窗口内被击中
    if (defender.blocking && defender.parryTimer > 0 && defender.parryCooldown <= 0) {
      defender.parryTimer = 0;
      defender.parryCooldown = D.parry.cooldownSec;
      defender.stamina = Math.min(D.stamina.max, defender.stamina + D.parry.staminaGain);
      const stun = defender.shield ? D.parry.shieldStunSec : D.parry.stunSec;
      attacker.mode = 'hurt';
      attacker.modeTimer = stun;
      attacker.vx = -attacker.facing * D.parry.knockback;
      attacker.blocking = false;
      this.hitStop = D.hitStopSec * 1.8;
      this.shake = Math.max(this.shake, D.shakeOnParry);

      if (defender.shield) {
        // 盾反：反弹一部分伤害回去
        const reflect = attacker.damage * D.parry.reflectRatio * (1 - attacker.reduction);
        attacker.hp = Math.max(0, attacker.hp - reflect);
        this.pushEffect('counter', contactX, contactY, reflect);
        if (attacker.hp <= 0) {
          attacker.mode = 'ko';
          attacker.vx = 0;
          this.pushEffect('ko', attacker.x, attacker.y - 40, 0);
        }
      } else {
        this.pushEffect('parry', contactX, contactY, 0);
      }
      return;
    }

    let damage = attacker.damage * (1 - defender.reduction);

    if (defender.blocking) {
      damage *= defender.shield ? D.block.shieldMultiplier : D.block.damageMultiplier;
      defender.stamina -= D.block.staminaHitCost;
      if (defender.stamina <= 0) {
        // 破防：本次伤害不打折，并产生较长的硬直。
        damage = attacker.damage * (1 - defender.reduction);
        defender.stamina = 0;
        defender.blocking = false;
        defender.mode = 'hurt';
        defender.modeTimer = D.block.guardBreakSec;
        defender.vx = attacker.facing * D.hurt.knockback;
        this.pushEffect('guard', contactX, contactY, damage);
      } else {
        this.pushEffect('block', contactX, contactY, damage);
      }
    } else {
      defender.mode = 'hurt';
      defender.modeTimer = D.hurt.durationSec;
      defender.vx = attacker.facing * D.hurt.knockback;
      defender.blocking = false;
      this.pushEffect('hit', contactX, contactY, damage);
    }

    defender.hp = Math.max(0, defender.hp - damage);
    defender.hitFlash = 0.14;
    this.hitStop = D.hitStopSec;
    this.shake = Math.max(this.shake, D.shakeOnHit);

    if (defender.hp <= 0) {
      defender.mode = 'ko';
      defender.blocking = false;
      defender.vx = 0;
      this.pushEffect('ko', defender.x, defender.y - 40, 0);
    }
  }

  private separate(): void {
    const [l, r] = this.fighters;
    // 只有站在同一高度附近才会互相挤开，避免上下层站位被误推
    if (Math.abs(l.y - r.y) > 40) return;
    const gap = D.bodyHalfWidth * 2;
    const dx = r.x - l.x;
    if (Math.abs(dx) < gap) {
      const sign = dx >= 0 ? 1 : -1;
      const push = (gap - Math.abs(dx)) / 2;
      l.x -= push * sign;
      r.x += push * sign;
      l.x = Math.max(D.arena.minX, Math.min(D.arena.maxX, l.x));
      r.x = Math.max(D.arena.minX, Math.min(D.arena.maxX, r.x));
    }
  }

  private decayEffects(dt: number): void {
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0).slice(-28);
  }

  private pushEffect(kind: DuelEffect['kind'], x: number, y: number, damage: number): void {
    const life =
      kind === 'ko'
        ? 1.2
        : kind === 'jump' || kind === 'land'
          ? 0.26
          : kind === 'parry' || kind === 'counter'
            ? 0.7
            : 0.45;
    this.effects.push({ kind, x, y, life, damage });
  }

  private checkOutcome(): void {
    const [l, r] = this.fighters;
    if (l.hp <= 0 || r.hp <= 0) {
      const leftDead = l.hp <= 0;
      const rightDead = r.hp <= 0;
      if (leftDead && rightDead) {
        this.finish('draw', null, null, '双方同时倒下，判定平局');
      } else if (leftDead) {
        this.finish('ko', r.unitId, l.unitId, '击倒对手获胜');
      } else {
        this.finish('ko', l.unitId, r.unitId, '击倒对手获胜');
      }
      return;
    }
    if (this.elapsed >= this.durationSec) {
      if (Math.abs(l.hp - r.hp) < 1e-6) {
        this.finish('draw', null, null, '时间到，双方剩余血量相同，判定平局');
      } else if (l.hp > r.hp) {
        this.finish('timeout', l.unitId, r.unitId, '时间到，剩余血量更高者获胜');
      } else {
        this.finish('timeout', r.unitId, l.unitId, '时间到，剩余血量更高者获胜');
      }
    }
  }

  private finish(
    kind: DuelResult['kind'],
    winnerUnitId: string | null,
    loserUnitId: string | null,
    reason: string,
  ): void {
    const [l, r] = this.fighters;
    this.result = {
      kind,
      winnerUnitId,
      loserUnitId,
      leftUnitId: l.unitId,
      rightUnitId: r.unitId,
      leftHp: Math.max(0, l.hp),
      rightHp: Math.max(0, r.hp),
      reason,
    };
  }
}
