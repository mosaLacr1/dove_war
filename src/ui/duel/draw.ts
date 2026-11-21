import { BALANCE } from '../../core/config/balance';
import type { DuelSnapshot } from '../../core/combat/duel';
import type { FighterView } from '../../core/combat/types';
import type { Theme } from '../theme';

const GROUND: number = BALANCE.duel.arena.groundY;
const PLATFORMS = BALANCE.duel.platforms;

export const DUEL_W = BALANCE.duel.arena.width;
export const DUEL_H = BALANCE.duel.arena.height;

interface Palette {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  arc: string;
  cloud: string;
  mountain: string;
  ground: string;
  groundEdge: string;
  groundTick: string;
  platformFill: string;
  platformEdge: string;
  platformHatch: string;
  p1: string;
  p2: string;
  shield: string;
  shieldFill: string;
  dodge: string;
  hitSpark: string;
  guardSpark: string;
  damageText: string;
  shadow: string;
}

const PALETTES: Record<Theme, Palette> = {
  light: {
    skyTop: '#f2f8fd',
    skyMid: '#e2eef8',
    skyBottom: '#cfe2f0',
    arc: 'rgba(46, 96, 133, 0.12)',
    cloud: 'rgba(120, 160, 190, 0.55)',
    mountain: 'rgba(120, 150, 175, 0.35)',
    ground: '#d9c9a8',
    groundEdge: '#9a855f',
    groundTick: 'rgba(120, 100, 70, 0.18)',
    platformFill: '#c9b592',
    platformEdge: '#8d7852',
    platformHatch: 'rgba(120, 100, 70, 0.25)',
    p1: '#0b8a58',
    p2: '#b96a00',
    shield: 'rgba(30, 110, 190, 0.95)',
    shieldFill: 'rgba(30, 110, 190, 0.12)',
    dodge: 'rgba(90, 110, 130, 0.8)',
    hitSpark: 'rgba(200, 80, 40, 0.95)',
    guardSpark: 'rgba(200, 40, 40, 0.95)',
    damageText: '#8c2f0d',
    shadow: 'rgba(90, 70, 40, 0.22)',
  },
  dark: {
    skyTop: '#0a0e13',
    skyMid: '#101821',
    skyBottom: '#080b10',
    arc: 'rgba(120, 180, 210, 0.08)',
    cloud: 'rgba(140, 180, 210, 0.18)',
    mountain: 'rgba(80, 110, 140, 0.25)',
    ground: '#141c25',
    groundEdge: '#2b3644',
    groundTick: 'rgba(120, 160, 200, 0.14)',
    platformFill: '#18222d',
    platformEdge: '#3a4c60',
    platformHatch: 'rgba(120, 160, 200, 0.12)',
    p1: '#3ddc97',
    p2: '#ffb454',
    shield: 'rgba(130, 205, 255, 0.95)',
    shieldFill: 'rgba(130, 205, 255, 0.14)',
    dodge: 'rgba(180, 200, 220, 0.8)',
    hitSpark: 'rgba(255, 220, 150, 0.95)',
    guardSpark: 'rgba(255, 90, 90, 0.95)',
    damageText: '#ffe3b0',
    shadow: 'rgba(0, 0, 0, 0.35)',
  },
};

export function drawDuel(ctx: CanvasRenderingContext2D, snap: DuelSnapshot, theme: Theme): void {
  const width = DUEL_W;
  const height = DUEL_H;
  const p = PALETTES[theme];

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.65, p.skyMid);
  sky.addColorStop(1, p.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawBackdrop(ctx, p);

  // 地面
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, GROUND, width, height - GROUND);
  ctx.strokeStyle = p.groundEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  ctx.lineTo(width, GROUND);
  ctx.stroke();

  ctx.strokeStyle = p.groundTick;
  ctx.lineWidth = 1;
  for (let x = 40; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND);
    ctx.lineTo(x - 14, height);
    ctx.stroke();
  }

  // 高低台
  for (const platform of PLATFORMS) {
    const thickness = 9;
    ctx.fillStyle = p.platformFill;
    ctx.fillRect(platform.x1, platform.y, platform.x2 - platform.x1, thickness);
    ctx.strokeStyle = p.platformEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(platform.x1, platform.y);
    ctx.lineTo(platform.x2, platform.y);
    ctx.stroke();

    ctx.strokeStyle = p.platformHatch;
    ctx.lineWidth = 1;
    for (let x = platform.x1 + 10; x < platform.x2 - 6; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, platform.y + 2);
      ctx.lineTo(x - 5, platform.y + thickness - 1);
      ctx.stroke();
    }
    // 台面下的支撑柱，避免看起来悬空
    ctx.strokeStyle = p.platformEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(platform.x1 + 14, platform.y + thickness);
    ctx.lineTo(platform.x1 + 14, GROUND);
    ctx.moveTo(platform.x2 - 14, platform.y + thickness);
    ctx.lineTo(platform.x2 - 14, GROUND);
    ctx.stroke();
  }

  // 命中抖屏
  const shake = snap.shake;
  ctx.save();
  if (shake > 0.2) {
    const t = snap.elapsed * 60;
    ctx.translate(Math.sin(t * 1.7) * shake * 0.5, Math.cos(t * 2.3) * shake * 0.35);
  }

  drawFighter(ctx, snap.fighters[0], p);
  drawFighter(ctx, snap.fighters[1], p);

  for (const effect of snap.effects) {
    const alpha = Math.max(0, Math.min(1, effect.life / 0.45));
    if (effect.kind === 'hit' || effect.kind === 'guard') {
      ctx.strokeStyle = effect.kind === 'guard' ? p.guardSpark : p.hitSpark;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      const spread = 16 + 18 * (1 - alpha);
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i + 0.3;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(effect.x + Math.cos(angle) * spread, effect.y + Math.sin(angle) * spread);
        ctx.stroke();
      }
      if (effect.damage > 0) {
        ctx.fillStyle = p.damageText;
        ctx.font = 'bold 22px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`-${Math.round(effect.damage)}`, effect.x, effect.y - 24 - (1 - alpha) * 30);
      }
      ctx.globalAlpha = 1;
    } else if (effect.kind === 'block') {
      ctx.strokeStyle = p.shield;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 26, -Math.PI / 2.4, Math.PI / 2.4);
      ctx.stroke();
      ctx.fillStyle = p.shield;
      ctx.font = 'bold 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('格挡', effect.x, effect.y - 34);
      ctx.globalAlpha = 1;
    } else if (effect.kind === 'parry' || effect.kind === 'counter') {
      const isCounter = effect.kind === 'counter';
      const grow = 1 + (1 - alpha) * 0.8;
      ctx.strokeStyle = isCounter ? p.hitSpark : p.shield;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 3; i += 1) {
        ctx.lineWidth = 3 - i * 0.6;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, (16 + i * 11) * grow, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = isCounter ? p.hitSpark : p.shield;
      ctx.font = 'bold 20px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(isCounter ? '盾反！' : '格挡！', effect.x, effect.y - 42 - (1 - alpha) * 22);
      if (effect.damage > 0) {
        ctx.fillStyle = p.damageText;
        ctx.fillText(`-${Math.round(effect.damage)}`, effect.x, effect.y - 68 - (1 - alpha) * 22);
      }
      ctx.globalAlpha = 1;
    } else if (effect.kind === 'dodge') {
      ctx.strokeStyle = p.dodge;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 10 + (1 - alpha) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (effect.kind === 'land' || effect.kind === 'jump') {
      ctx.strokeStyle = p.platformEdge;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const dir = i < 2 ? -1 : 1;
        const offset = 10 + i * 9;
        ctx.beginPath();
        ctx.moveTo(effect.x + dir * offset, effect.y);
        ctx.lineTo(effect.x + dir * (offset + 12), effect.y - 6);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

function drawBackdrop(ctx: CanvasRenderingContext2D, p: Palette): void {
  // 远山
  ctx.strokeStyle = p.mountain;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, 360);
  ctx.lineTo(120, 250);
  ctx.lineTo(240, 340);
  ctx.lineTo(370, 230);
  ctx.lineTo(520, 350);
  ctx.lineTo(700, 240);
  ctx.lineTo(840, 330);
  ctx.lineTo(980, 250);
  ctx.stroke();

  // 云
  ctx.strokeStyle = p.cloud;
  ctx.lineWidth = 2;
  for (const [cx, cy, scale] of [
    [180, 120, 1],
    [520, 90, 0.8],
    [760, 150, 1.1],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(cx - 40 * scale, cy);
    ctx.quadraticCurveTo(cx - 30 * scale, cy - 18 * scale, cx - 8 * scale, cy - 12 * scale);
    ctx.quadraticCurveTo(cx + 6 * scale, cy - 26 * scale, cx + 24 * scale, cy - 10 * scale);
    ctx.quadraticCurveTo(cx + 44 * scale, cy - 14 * scale, cx + 48 * scale, cy);
    ctx.stroke();
  }

  // 背景弧
  ctx.strokeStyle = p.arc;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.arc(DUEL_W / 2, DUEL_H + 60, 280 + i * 90, Math.PI, 0);
    ctx.stroke();
  }
}

function shadowY(f: FighterView): number {
  let best: number = GROUND;
  for (const platform of PLATFORMS) {
    if (f.x + 20 <= platform.x1 || f.x - 20 >= platform.x2) continue;
    if (platform.y >= f.y - 1 && platform.y < best) best = platform.y;
  }
  return best;
}

function drawFighter(ctx: CanvasRenderingContext2D, f: FighterView, p: Palette): void {
  const color = f.owner === 0 ? p.p1 : p.p2;
  const base = f.y;
  const facing = f.facing;
  const isHurt = f.hitFlash > 0;
  const height = GROUND - f.y;

  // 影子（贴在最靠近的地面/台面上，跳得越高越淡）
  const sy = shadowY(f);
  const fade = Math.max(0.15, 1 - height / 260);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = p.shadow;
  ctx.beginPath();
  ctx.ellipse(f.x, sy + 4, 30 * fade + 8, 7 * fade + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(f.x, base);

  if (f.mode === 'ko') {
    ctx.translate(0, 12);
    ctx.scale(1, 0.42);
  } else if (f.mode === 'windup') {
    ctx.translate(-facing * 7, 0);
    ctx.rotate(-facing * 0.07);
  } else if (f.mode === 'strike') {
    ctx.translate(facing * 14, 0);
    ctx.rotate(facing * 0.1);
  } else if (f.mode === 'dash') {
    ctx.strokeStyle = p.dodge;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-facing * (30 + i * 18), -70 + i * 8);
      ctx.lineTo(-facing * (52 + i * 18), -70 + i * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = isHurt ? p.guardSpark : color;
  ctx.fillStyle = isHurt ? 'rgba(255,90,90,0.18)' : 'transparent';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (f.invulnerable && f.mode !== 'ko') ctx.setLineDash([6, 6]);

  // 腿
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  ctx.lineTo(-10, -2);
  ctx.moveTo(10, -22);
  ctx.lineTo(10, -2);
  ctx.stroke();

  // 尾巴
  ctx.beginPath();
  ctx.moveTo(-facing * 24, -54);
  ctx.lineTo(-facing * 46, -66);
  ctx.stroke();

  // 身体
  ctx.beginPath();
  ctx.ellipse(0, -54, 30, 21, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 翅膀（空中时展开）
  ctx.beginPath();
  if (f.onGround) {
    ctx.moveTo(-8, -62);
    ctx.quadraticCurveTo(facing * 6, -34, facing * 20, -44);
  } else {
    ctx.moveTo(-6, -62);
    ctx.quadraticCurveTo(-facing * 18, -84, -facing * 30, -70);
    ctx.moveTo(-4, -58);
    ctx.quadraticCurveTo(facing * 18, -78, facing * 30, -64);
  }
  ctx.stroke();

  // 头
  ctx.beginPath();
  ctx.arc(facing * 26, -82, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 喙
  ctx.beginPath();
  ctx.moveTo(facing * 38, -86);
  ctx.lineTo(facing * 54, -80);
  ctx.lineTo(facing * 38, -76);
  ctx.closePath();
  ctx.stroke();

  // 眼睛
  if (f.mode === 'ko') {
    ctx.beginPath();
    ctx.moveTo(facing * 26, -90);
    ctx.lineTo(facing * 34, -82);
    ctx.moveTo(facing * 34, -90);
    ctx.lineTo(facing * 26, -82);
    ctx.stroke();
  } else {
    ctx.fillStyle = isHurt ? p.guardSpark : color;
    ctx.beginPath();
    ctx.arc(facing * 30, -86, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.setLineDash([]);
  ctx.restore();

  // 攻击挥砍弧线
  if (f.mode === 'strike') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x + facing * 20, base - 62, 52, -0.7, 0.7);
    ctx.stroke();
  }

  // 格挡护盾（副手有盾时更厚重）
  if (f.blocking) {
    const gx = f.x + facing * 46;
    const gy = base - 60;
    const radius = f.shield ? 34 : 30;
    ctx.strokeStyle = p.shield;
    ctx.fillStyle = p.shieldFill;
    ctx.lineWidth = f.shield ? 4 : 3;
    ctx.beginPath();
    ctx.arc(gx, gy, radius, -Math.PI / 2.1, Math.PI / 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gx, gy, radius - 8, -Math.PI / 2.3, Math.PI / 2.3);
    ctx.stroke();
    if (f.shield) {
      ctx.fillStyle = p.shieldFill;
      ctx.beginPath();
      ctx.arc(gx, gy, radius, -Math.PI / 2.1, Math.PI / 2.1);
      ctx.closePath();
      ctx.fill();
    }
    if (f.parryReady) {
      ctx.strokeStyle = p.hitSpark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, radius + 7, -Math.PI / 2.4, Math.PI / 2.4);
      ctx.stroke();
    }
  }
}
