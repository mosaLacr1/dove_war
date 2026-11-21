import { useEffect, useState, type ReactNode } from 'react';
import { ItemGlyph, DoveGlyph } from '../icons';

interface Step {
  title: string;
  body: string;
  art: ReactNode;
}

function Flow({ nodes }: { nodes: { glyph: ReactNode; label: string }[] }) {
  return (
    <div className="tut-flow">
      {nodes.map((node, index) => (
        <div className="tut-flow-item" key={`${node.label}-${index}`}>
          <div className="tut-node">
            <span className="tut-node-icon">{node.glyph}</span>
            <span className="tut-node-label">{node.label}</span>
          </div>
          {index < nodes.length - 1 && <span className="tut-arrow">→</span>}
        </div>
      ))}
    </div>
  );
}

/** 3×3 迷你棋盘：中心是斑鸠，右侧可挖，下方可走。 */
function BoardScene() {
  return (
    <div className="tut-board" aria-hidden="true">
      <span className="tut-bcell" />
      <span className="tut-bcell" />
      <span className="tut-bcell on-mine">
        <ItemGlyph item="planks" />
      </span>
      <span className="tut-bcell" />
      <span className="tut-bcell on-unit">
        <DoveGlyph owner={0} />
      </span>
      <span className="tut-bcell" />
      <span className="tut-bcell" />
      <span className="tut-bcell on-move" />
      <span className="tut-bcell" />
    </div>
  );
}

/** 决斗舞台缩略图：地面 + 三层平台 + 两只斑鸠。 */
function StageScene({ withFighters }: { withFighters?: boolean }) {
  return (
    <div className="tut-stage" aria-hidden="true">
      <span className="tut-stage-platform left" />
      <span className="tut-stage-platform right" />
      <span className="tut-stage-platform mid" />
      <span className="tut-stage-ground" />
      <span className="tut-stage-timer">60s</span>
      {withFighters && (
        <>
          <span className="tut-stage-hp left">
            <i style={{ width: '82%' }} />
          </span>
          <span className="tut-stage-hp right">
            <i style={{ width: '58%' }} />
          </span>
          <span className="tut-fighter p1">
            <DoveGlyph owner={0} />
          </span>
          <span className="tut-fighter p2 flip">
            <DoveGlyph owner={1} />
          </span>
        </>
      )}
    </div>
  );
}

/** 一次交锋：出手 → 命中 → 掉血。 */
function ClashScene() {
  return (
    <div className="tut-clash" aria-hidden="true">
      <span className="tut-fighter p1">
        <DoveGlyph owner={0} />
      </span>
      <svg className="tut-slash" viewBox="0 0 70 80" width="70" height="80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M18 66c-8-18-6-34 6-46" />
        <path d="M30 62c-4-14-2-26 6-36" />
      </svg>
      <span className="tut-damage">-9</span>
      <span className="tut-fighter p2 flip">
        <DoveGlyph owner={1} />
      </span>
      <span className="tut-keycap">左键</span>
    </div>
  );
}

/** 三种防守手段 + 盾反。 */
function DefenseScene() {
  return (
    <div className="tut-defense" aria-hidden="true">
      <div className="tut-def-card">
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M16 4l10 3v8c0 6-4 10-10 13-6-3-10-7-10-13V7z" />
        </svg>
        <strong>S 格挡</strong>
        <span>伤害 ×0.3</span>
      </div>
      <div className="tut-def-card is-parry">
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M16 4l10 3v8c0 6-4 10-10 13-6-3-10-7-10-13V7z" />
          <path d="M12 16l3 3 6-7" />
        </svg>
        <strong>盾反</strong>
        <span>右键 · 需盾</span>
      </div>
      <div className="tut-def-card">
        <svg viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M18 4L8 18h7l-1 10 10-14h-7z" />
        </svg>
        <strong>双击 A/D</strong>
        <span>冲刺无敌</span>
      </div>
      <div className="tut-def-card">
        <div className="tut-stamina">
          <i style={{ width: '62%' }} />
        </div>
        <strong>耐力</strong>
        <span>打空会破防</span>
      </div>
    </div>
  );
}

/** 盾牌配方与副手。 */
function ShieldScene() {
  return (
    <div className="tut-shield">
      <Flow
        nodes={[
          { glyph: <ItemGlyph item="planks" />, label: '6 木板' },
          { glyph: <ItemGlyph item="iron_ingot" />, label: '1 铁锭' },
          { glyph: <ItemGlyph item="shield" />, label: '盾牌' },
          { glyph: <ItemGlyph item="iron_sword" />, label: '副手槽' },
        ]}
      />
      <p className="tut-shield-note">装备在副手后：右键也能格挡，格挡减伤更强，完美格挡会盾反。</p>
    </div>
  );
}

/** 键位速查。 */
function KeysScene() {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ['左键'], label: '攻击（朝鼠标方向）' },
    { keys: ['右键'], label: '格挡 / 盾反（需盾牌）' },
    { keys: ['S'], label: '格挡（同样能盾反）' },
    { keys: ['双击 A/D'], label: '冲刺闪避' },
    { keys: ['空格'], label: '跳跃（按住更高）' },
    { keys: ['移动鼠标'], label: '决定面朝方向' },
  ];
  return (
    <div className="tut-keys" aria-hidden="true">
      {rows.map((row) => (
        <div className="tut-keyrow" key={row.label}>
          <span className="tut-keycap-group">
            {row.keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
          </span>
          <span>{row.label}</span>
        </div>
      ))}
      <p className="tut-keys-note">触屏：底部 ← → 跳 攻击 格挡 冲刺</p>
    </div>
  );
}

const STEPS: Step[] = [
  {
    title: '目标：让对手的斑鸠全部消失',
    body: '你和电脑各有一只斑鸠，地图中间是资源。谁先摧毁对方的全部斑鸠，谁就赢。',
    art: (
      <div className="tut-versus">
        <span className="tut-dove">
          <DoveGlyph owner={0} />
        </span>
        <span className="tut-vs">VS</span>
        <span className="tut-dove-p2">
          <DoveGlyph owner={1} />
        </span>
      </div>
    ),
  },
  {
    title: '每只斑鸠每回合 2 次行动',
    body: '移动与挖掘各消耗 1 次。用完后自动换手；两只斑鸠加起来就是 4 次行动，不是两人共享。',
    art: (
      <div className="tut-pips">
        <span className="tut-dove">
          <DoveGlyph owner={0} />
        </span>
        <span className="pips">
          <i className="on" />
          <i className="on" />
        </span>
        <span className="tut-caption">2 次行动 / 回合</span>
      </div>
    ),
  },
  {
    title: '点相邻格移动，点资源格挖掘',
    body: '蓝框是可走的位置，橙框是可挖的资源。资源不阻挡移动——底栏可以在「挖掘 / 移动」之间切换。',
    art: <BoardScene />,
  },
  {
    title: '第一段科技线：木头 → 木板 → 工作台 → 木镐',
    body: '空手砍木头，木板做工作台，工作台再做木镐。有了木镐才能挖石头，工具等级决定能挖什么。',
    art: (
      <Flow
        nodes={[
          { glyph: <ItemGlyph item="log" />, label: '原木' },
          { glyph: <ItemGlyph item="planks" />, label: '木板' },
          { glyph: <ItemGlyph item="crafting_table" />, label: '工作台' },
          { glyph: <ItemGlyph item="wooden_pickaxe" />, label: '木镐' },
        ]}
      />
    ),
  },
  {
    title: '生铁块要拆开再烧',
    body: '1 个生铁块拆成 9 个生铁，生铁进熔炉才变成铁锭。木板和木棍可以当燃料，熔炼本身不花行动。',
    art: (
      <Flow
        nodes={[
          { glyph: <ItemGlyph item="raw_iron_block" />, label: '生铁块' },
          { glyph: <ItemGlyph item="raw_iron" />, label: '9 生铁' },
          { glyph: <ItemGlyph item="furnace" />, label: '熔炉' },
          { glyph: <ItemGlyph item="iron_ingot" />, label: '铁锭' },
        ]}
      />
    ),
  },
  {
    title: '孵化新斑鸠：只消耗门槛道具',
    body: '三只新斑鸠分别需要工作台、石镐、铁剑，孵化时这三个道具会被消耗，不需要任何材料。新斑鸠下一回合才能行动。',
    art: (
      <Flow
        nodes={[
          { glyph: <ItemGlyph item="crafting_table" />, label: '工作台' },
          { glyph: <ItemGlyph item="stone_pickaxe" />, label: '石镐' },
          { glyph: <ItemGlyph item="iron_sword" />, label: '铁剑' },
          { glyph: <DoveGlyph owner={0} />, label: '斑鸠' },
        ]}
      />
    ),
  },
  {
    title: '正交相邻就开战',
    body: '两只敌对斑鸠上下左右贴住时，地图立刻暂停，进入限时 60 秒的横版决斗。斜角相邻不算。',
    art: <StageScene withFighters />,
  },
  {
    title: '怎么打：靠近 → 左键 → 打中掉血',
    body: '先走位贴近对手（A/D），进入挥砍范围后按鼠标左键出手。出手方向由鼠标位置决定，有约 0.15 秒前摇；命中掉血并顿帧，没打中就是空挥。',
    art: <ClashScene />,
  },
  {
    title: '怎么防：格挡、盾反、冲刺、抢高台',
    body: 'S 或右键格挡把伤害压到三成，但持续掉耐力，耐力见底会破防硬直。在对手命中前一瞬按下格挡＝完美格挡，对手会僵住。双击 A/D 冲刺带无敌帧。站上高台，地面的人打不到你。',
    art: <DefenseScene />,
  },
  {
    title: '盾牌：装副手，能盾反',
    body: '6 木板 + 1 铁锭合成盾牌，装进副手槽。举盾减伤更强、右键也能格挡；完美格挡会触发盾反，把一部分伤害弹回去并把对手打僵。',
    art: <ShieldScene />,
  },
  {
    title: '操作与胜负',
    body: '击倒对手立刻获胜；60 秒到就比剩余血量，相同则平局并各自返回地图。血条在左右上角，倒计时在中间；难度可以在标题页或结算页调整。',
    art: <KeysScene />,
  },
];

export function Tutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = STEPS[index] as Step;
  const isLast = index === STEPS.length - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && index < STEPS.length - 1) setIndex((i) => i + 1);
      if (event.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose]);

  return (
    <div className="tutorial-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tutorial-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tut-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="tut-counter">
          {index + 1} / {STEPS.length}
        </span>

        <div className="tut-art">{step.art}</div>
        <h2 id="tut-title">{step.title}</h2>
        <p className="tut-body">{step.body}</p>

        <div className="tut-dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={i === index ? 'tut-dot active' : 'tut-dot'}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div className="tut-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            跳过
          </button>
          <div className="tut-nav">
            <button
              type="button"
              className="btn"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              上一步
            </button>
            {isLast ? (
              <button type="button" className="btn btn-primary" onClick={onClose}>
                开始游戏
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setIndex((i) => i + 1)}>
                下一步
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
