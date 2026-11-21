import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BALANCE } from '../../core/config/balance';
import { DuelSim, type DuelSnapshot } from '../../core/combat/duel';
import type { DuelInput, FighterView } from '../../core/combat/types';
import { difficultyOf } from '../../core/config/difficulty';
import { ITEMS } from '../../core/config/items';
import type { DuelFighterInit, DuelResult, DuelState, GameState } from '../../core/types';
import { drawDuel, DUEL_H, DUEL_W } from '../duel/draw';
import type { Theme } from '../theme';
import { playSound } from '../sound';

interface DuelScreenProps {
  game: GameState;
  duel: DuelState;
  theme: Theme;
  onFinish: (result: DuelResult) => void;
}

type BooleanKey = 'left' | 'right' | 'attack' | 'block' | 'dash' | 'jump';

const KEYMAP: Record<string, BooleanKey> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyS: 'block',
  KeyK: 'block',
  ShiftLeft: 'block',
  ShiftRight: 'block',
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
  KeyJ: 'attack',
  KeyZ: 'attack',
  KeyL: 'dash',
  KeyX: 'dash',
};

const DOUBLE_TAP_MS = BALANCE.duel.doubleTapSec * 1000;

function fighterName(game: GameState, init: DuelFighterInit): string {
  const unit = game.units.find((u) => u.id === init.unitId);
  const owner = init.owner === 0 ? '玩家 1' : '电脑';
  const gear = unit?.equipment;
  const parts: string[] = [];
  if (gear?.weapon) parts.push(ITEMS[gear.weapon].name);
  if (gear?.offhand) parts.push(ITEMS[gear.offhand].name);
  if (gear?.head) parts.push('盔');
  if (gear?.chest) parts.push('甲');
  if (gear?.legs) parts.push('腿');
  if (gear?.feet) parts.push('靴');
  return `${owner} · ${init.unitId}${parts.length ? ` · ${parts.join('')}` : ' · 赤手空拳'}`;
}

export function DuelScreen({ game, duel, theme, onFinish }: DuelScreenProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<DuelSim | null>(null);
  const themeRef = useRef<Theme>(theme);
  const aimRef = useRef<number | null>(null);
  const mouseAttackRef = useRef(false);
  const mouseBlockRef = useRef(false);
  const lastAutoAttackRef = useRef(0);
  const lastTapRef = useRef({ left: 0, right: 0 });
  const inputRef = useRef<DuelInput>({
    left: false,
    right: false,
    attack: false,
    block: false,
    dash: false,
    jump: false,
    aimX: null,
  });
  /** 一次性按键（攻击/冲刺/跳跃）的缓冲：即使按下与抬起落在同一帧之间也不会丢失。 */
  const pendingRef = useRef<{ attack: boolean; dash: boolean; jump: boolean }>({
    attack: false,
    dash: false,
    jump: false,
  });
  const [hud, setHud] = useState<DuelSnapshot | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  if (!simRef.current) {
    simRef.current = new DuelSim({
      seed: duel.seed,
      left: duel.left,
      right: duel.right,
      aiSides: ['right'],
      aiProfile: difficultyOf(game.difficulty).duel,
    });
  }

  const leftName = useMemo(() => fighterName(game, duel.left), [game, duel.left]);
  const rightName = useMemo(() => fighterName(game, duel.right), [game, duel.right]);
  const playerHasShield = duel.left.shield;

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !sim) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = DUEL_W * dpr;
    canvas.height = DUEL_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudClock = 0;
    let lastHpSum = -1;

    const loop = (now: number): void => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      if (!sim.finished) {
        // 鼠标按住左键 = 连续出手（按模拟冷却节流）
        if (mouseAttackRef.current && now - lastAutoAttackRef.current > 110) {
          pendingRef.current.attack = true;
          lastAutoAttackRef.current = now;
        }

        const held = inputRef.current;
        const pending = pendingRef.current;
        const frameInput: DuelInput = {
          left: held.left,
          right: held.right,
          block: held.block || mouseBlockRef.current,
          attack: held.attack || pending.attack,
          dash: held.dash || pending.dash,
          jump: held.jump || pending.jump,
          aimX: aimRef.current,
        };

        acc += dt;
        const step = BALANCE.duel.tickSec;
        let guard = 0;
        while (acc >= step && guard < 6) {
          sim.step(step, frameInput);
          acc -= step;
          guard += 1;
        }
        pending.attack = false;
        pending.dash = false;
        pending.jump = false;
      }

      const snap = sim.getSnapshot();
      drawDuel(ctx, snap, themeRef.current);

      const hpSum = snap.fighters[0].hp + snap.fighters[1].hp;
      if (lastHpSum >= 0 && hpSum < lastHpSum - 0.01) playSound('hit');
      lastHpSum = hpSum;

      hudClock += dt;
      if (hudClock > 0.08 || sim.finished) {
        hudClock = 0;
        setHud(snap);
      }

      if (sim.finished) {
        if (sim.finalResult) setResult(sim.finalResult);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onDown = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      const key = KEYMAP[event.code];
      if (!key) return;
      event.preventDefault();
      inputRef.current[key] = true;
      if (key === 'attack' || key === 'dash' || key === 'jump') pendingRef.current[key] = true;

      // 双击左右 = 冲刺
      const now = performance.now();
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        if (now - lastTapRef.current.left < DOUBLE_TAP_MS) pendingRef.current.dash = true;
        lastTapRef.current.left = now;
      } else if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        if (now - lastTapRef.current.right < DOUBLE_TAP_MS) pendingRef.current.dash = true;
        lastTapRef.current.right = now;
      }
    };
    const onUp = (event: KeyboardEvent): void => {
      const key = KEYMAP[event.code];
      if (!key) return;
      event.preventDefault();
      inputRef.current[key] = false;
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // 鼠标：位置决定朝向，左键攻击，右键格挡（需盾牌）
  const toLogicalX = useCallback((clientX: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return DUEL_W / 2;
    const rect = canvas.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * DUEL_W;
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent): void => {
      aimRef.current = toLogicalX(event.clientX);
    };
    const onPointerUp = (): void => {
      mouseAttackRef.current = false;
      mouseBlockRef.current = false;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [toLogicalX]);

  const onCanvasPointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      aimRef.current = toLogicalX(event.clientX);
      if (event.button === 0) {
        mouseAttackRef.current = true;
        pendingRef.current.attack = true;
        lastAutoAttackRef.current = performance.now();
      } else if (event.button === 2 && playerHasShield) {
        event.preventDefault();
        mouseBlockRef.current = true;
      }
    },
    [playerHasShield, toLogicalX],
  );

  const hold = useCallback((key: BooleanKey, value: boolean) => {
    inputRef.current[key] = value;
    if (value && (key === 'attack' || key === 'dash' || key === 'jump')) pendingRef.current[key] = true;
  }, []);

  const pressProps = (key: BooleanKey) => ({
    onPointerDown: (event: React.PointerEvent) => {
      event.preventDefault();
      hold(key, true);
    },
    onPointerUp: () => hold(key, false),
    onPointerLeave: () => hold(key, false),
    onPointerCancel: () => hold(key, false),
  });

  const fighters: [FighterView, FighterView] | null = hud ? hud.fighters : null;
  const timeLeft = hud ? hud.timeLeft : BALANCE.duel.durationSec;

  return (
    <div className="duel-screen">
      <div className="duel-top">
        <FighterCard name={leftName} fighter={fighters?.[0] ?? null} side="left" />
        <div className="duel-timer">
          <span className="timer-value">{Math.ceil(timeLeft)}</span>
          <span className="timer-label">秒</span>
        </div>
        <FighterCard name={rightName} fighter={fighters?.[1] ?? null} side="right" />
      </div>

      <div className="duel-stage">
        <canvas
          ref={canvasRef}
          className="duel-canvas"
          style={{ aspectRatio: `${DUEL_W} / ${DUEL_H}` }}
          onPointerDown={onCanvasPointerDown}
          onContextMenu={(event) => event.preventDefault()}
        />

        {result && (
          <div className="duel-result" role="dialog" aria-modal="true" aria-label="决斗结果">
            <h2 className={result.kind === 'draw' ? 'draw' : result.winnerUnitId === duel.left.unitId ? 'win' : 'lose'}>
              {result.kind === 'draw' ? '平局' : result.winnerUnitId === duel.left.unitId ? '你赢了' : '你输了'}
            </h2>
            <p className="duel-reason">{result.reason}</p>
            <div className="duel-hp-summary">
              <span>{leftName.split(' · ')[0]} 剩余 {Math.round(result.leftHp)}</span>
              <span className="vs">:</span>
              <span>{rightName.split(' · ')[0]} 剩余 {Math.round(result.rightHp)}</span>
            </div>
            <p className="muted small">
              {result.kind === 'draw' ? '双方都返回地图，不会损失斑鸠。' : '失败方的斑鸠被摧毁，装备不掉落。'}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => result && onFinish(result)}>
              返回地图
            </button>
          </div>
        )}
      </div>

      <div className="duel-controls">
        <div className="touch-row">
          <button type="button" className="btn touch" {...pressProps('left')} aria-label="向左移动">
            ←
          </button>
          <button type="button" className="btn touch" {...pressProps('right')} aria-label="向右移动">
            →
          </button>
          <button type="button" className="btn touch touch-jump" {...pressProps('jump')}>
            跳
          </button>
          <button type="button" className="btn touch touch-attack" {...pressProps('attack')}>
            攻击
          </button>
          <button type="button" className="btn touch touch-block" {...pressProps('block')}>
            格挡
          </button>
          <button type="button" className="btn touch touch-dash" {...pressProps('dash')}>
            冲刺
          </button>
        </div>
        <p className="duel-hints">
          鼠标左键 攻击 · <strong>鼠标朝向</strong>决定出手方向 · S 格挡
          {playerHasShield ? '（右键也可）' : '（装备盾牌后右键也能格挡）'} · 双击 A/D 冲刺 · 空格 跳
        </p>
      </div>
    </div>
  );
}

function FighterCard({ name, fighter, side }: { name: string; fighter: FighterView | null; side: 'left' | 'right' }) {
  const hpRatio = fighter ? Math.max(0, fighter.hp / fighter.maxHp) : 1;
  const staminaRatio = fighter ? Math.max(0, fighter.stamina / BALANCE.duel.stamina.max) : 1;
  return (
    <div className={`fighter-card ${side}`}>
      <div className="fighter-name">
        <span>{name}</span>
        <span className="hp-number">
          {fighter ? `${Math.round(fighter.hp)} / ${fighter.maxHp}` : '—'}
        </span>
      </div>
      <div className={`hp-bar ${hpRatio < 0.3 ? 'low' : ''}`}>
        <i style={{ width: `${hpRatio * 100}%` }} />
      </div>
      <div className="stamina-bar">
        <i style={{ width: `${staminaRatio * 100}%` }} />
      </div>
      <div className="fighter-state">
        {fighter?.mode === 'ko'
          ? '倒地'
          : fighter?.parryReady
            ? '盾反窗口！'
            : fighter?.blocking
              ? fighter.shield
                ? '举盾格挡'
                : '格挡中'
              : fighter?.invulnerable
                ? '闪避无敌'
                : fighter?.shield
                  ? '副手：盾牌'
                  : ' '}
      </div>
    </div>
  );
}
