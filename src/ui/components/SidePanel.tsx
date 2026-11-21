import { BALANCE } from '../../core/config/balance';
import { DOVE_TIERS, doveTierFor } from '../../core/config/doves';
import { ITEMS } from '../../core/config/items';
import { recipesByCategory } from '../../core/config/recipes';
import { countOf } from '../../core/inventory';
import { doveAvailability, playerUnits, smeltAvailability } from '../../core/selectors';
import type { GameState, ItemId, Unit } from '../../core/types';
import { ItemGlyph } from '../icons';
import { PlayerPanel } from './PlayerPanel';

export type SideTab = 'craft' | 'smelt' | 'dove' | 'inventory' | 'foe';

interface SidePanelProps {
  game: GameState;
  tab: SideTab;
  selectedUnit: Unit | null;
  onTab: (tab: SideTab) => void;
  onCraft: (recipeId: string) => void;
  onSmelt: (recipeId: string) => void;
  onFuel: (item: ItemId) => void;
  onDove: () => void;
  onItemClick: (item: ItemId) => void;
}

const TABS: { id: SideTab; label: string }[] = [
  { id: 'craft', label: '合成' },
  { id: 'smelt', label: '熔炼' },
  { id: 'dove', label: '孵卵' },
  { id: 'inventory', label: '库存' },
  { id: 'foe', label: '对手' },
];

const FUEL_ITEMS: ItemId[] = ['log', 'planks', 'stick', 'crafting_table'];

export function SidePanel(props: SidePanelProps) {
  const { game, tab } = props;
  const player = game.players[game.currentPlayer];
  const inv = player.inventory;
  const dove = doveAvailability(game);

  return (
    <section className="panel side-panel">
      <div className="side-tabs" role="tablist" aria-label="操作面板">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'side-tab active' : 'side-tab'}
            onClick={() => props.onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="side-body">
        {tab === 'craft' && (
          <>
            <p className="panel-note">合成不消耗行动次数（只有移动与挖掘消耗）。</p>
            <div className="recipe-list">
              {recipesByCategory('craft').map((recipe) => {
                const missing = recipe.inputs.filter((i) => countOf(inv, i.item) < i.count);
                const hasTable = countOf(inv, 'crafting_table') > 0;
                const blockedByTable = recipe.needsTable && !hasTable;
                const ok = missing.length === 0 && !blockedByTable && game.phase === 'map';
                const reason = blockedByTable
                  ? '需要工作台'
                  : missing.length > 0
                    ? `缺少 ${missing.map((m) => ITEMS[m.item].name).join('、')}`
                    : '';
                return (
                  <div key={recipe.id} className={`recipe-row ${ok ? '' : 'is-blocked'}`}>
                    <span className="recipe-icon">
                      <ItemGlyph item={recipe.output.item} />
                    </span>
                    <div className="recipe-main">
                      <div className="recipe-title">
                        {ITEMS[recipe.output.item].name}
                        {recipe.output.count > 1 && <span className="count"> ×{recipe.output.count}</span>}
                        {recipe.needsTable && <span className="tag">工作台</span>}
                      </div>
                      <div className="recipe-req">
                        {recipe.inputs.map((input) => {
                          const have = countOf(inv, input.item);
                          return (
                            <span key={input.item} className={have < input.count ? 'lack' : 'have'}>
                              {ITEMS[input.item].name} {have}/{input.count}
                            </span>
                          );
                        })}
                      </div>
                      <div className="recipe-meta">{reason || recipe.vanilla}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!ok}
                      title={reason}
                      onClick={() => props.onCraft(recipe.id)}
                    >
                      合成
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'smelt' && (
          <>
            <p className="panel-note">熔炼与拆解同样不消耗行动次数。</p>
            <div className="fuel-bar">
              <span>
                熔炉燃料：<strong>{player.furnaceFuel}</strong> 点
                {countOf(inv, 'furnace') < 1 && <em className="lack"> · 尚未合成熔炉</em>}
              </span>
              <div className="fuel-actions">
                {FUEL_ITEMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="btn btn-tiny"
                    disabled={countOf(inv, item) < 1 || game.phase !== 'map'}
                    title={`${ITEMS[item].name} 提供 ${ITEMS[item].fuelPoints} 点燃料`}
                    onClick={() => props.onFuel(item)}
                  >
                    +{ITEMS[item].name}
                  </button>
                ))}
              </div>
            </div>

            <div className="recipe-list">
              {recipesByCategory('smelt').map((recipe) => {
                const avail = smeltAvailability(game, recipe.id);
                return (
                  <div key={recipe.id} className={`recipe-row ${avail.ok ? '' : 'is-blocked'}`}>
                    <span className="recipe-icon">
                      <ItemGlyph item={recipe.output.item} />
                    </span>
                    <div className="recipe-main">
                      <div className="recipe-title">
                        {ITEMS[recipe.output.item].name}
                        <span className="tag">{recipe.fuelCost} 点燃料</span>
                      </div>
                      <div className="recipe-req">
                        {recipe.inputs.map((input) => (
                          <span key={input.item} className={countOf(inv, input.item) < input.count ? 'lack' : 'have'}>
                            {ITEMS[input.item].name} {countOf(inv, input.item)}/{input.count}
                          </span>
                        ))}
                      </div>
                      <div className="recipe-meta">{avail.ok ? recipe.vanilla : avail.reason}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!avail.ok}
                      title={avail.reason}
                      onClick={() => props.onSmelt(recipe.id)}
                    >
                      熔炼
                    </button>
                  </div>
                );
              })}

              <div className="recipe-row">
                <span className="recipe-icon">
                  <ItemGlyph item="raw_iron" />
                </span>
                <div className="recipe-main">
                  <div className="recipe-title">拆解生铁块 / 金块</div>
                  <div className="recipe-req">
                    <span className={countOf(inv, 'raw_iron_block') > 0 ? 'have' : 'lack'}>
                      生铁块 {countOf(inv, 'raw_iron_block')}
                    </span>
                    <span className={countOf(inv, 'gold_block') > 0 ? 'have' : 'lack'}>
                      金块 {countOf(inv, 'gold_block')}
                    </span>
                  </div>
                  <div className="recipe-meta">分别拆成 9 生铁 / 9 金锭，不消耗行动。</div>
                </div>
                <div className="btn-stack">
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={countOf(inv, 'raw_iron_block') < 1}
                    onClick={() => props.onCraft('uncraft_raw_iron_block')}
                  >
                    拆铁
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={countOf(inv, 'gold_block') < 1}
                    onClick={() => props.onCraft('uncraft_gold_block')}
                  >
                    拆金
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'dove' && (
          <>
            <div className="dove-summary">
              <span>
                已孵化 <strong>{player.dovesMade}</strong> / {BALANCE.doveLimit}
              </span>
              <span className="muted small">孵化只需要门槛道具，不消耗任何材料；新斑鸠下一回合才能行动。</span>
            </div>
            <div className="recipe-list">
              {DOVE_TIERS.map((tier) => {
                const active = doveTierFor(player.dovesMade)?.tier === tier.tier;
                const done = player.dovesMade >= tier.tier;
                return (
                  <div
                    key={tier.tier}
                    className={`recipe-row ${active ? 'is-active-tier' : ''} ${done ? 'is-done' : ''}`}
                  >
                    <span className="recipe-icon">
                      <ItemGlyph item="crafting_table" />
                    </span>
                    <div className="recipe-main">
                      <div className="recipe-title">
                        {tier.label}
                        {done && <span className="tag tag-done">已完成</span>}
                        {active && <span className="tag tag-live">当前</span>}
                      </div>
                      <div className="recipe-req">
                        {tier.consumes.map((item) => (
                          <span key={item} className={countOf(inv, item) >= 1 ? 'have' : 'lack'}>
                            消耗 {ITEMS[item].name} {countOf(inv, item)}/1
                          </span>
                        ))}
                      </div>
                      <div className="recipe-meta">{tier.note}</div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={!active || !dove.ok}
                      title={active ? dove.reasons.join('；') : '先完成上一阶'}
                      onClick={props.onDove}
                    >
                      孵化
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === 'inventory' && (
          <PlayerPanel
            player={game.players[0]}
            units={playerUnits(game, 0)}
            isCurrent={game.currentPlayer === 0 && game.phase === 'map'}
            onItemClick={props.onItemClick}
          />
        )}

        {tab === 'foe' && (
          <>
            <p className="panel-note">电脑的科技进度会直接影响下一场决斗的装备。</p>
            <PlayerPanel
              player={game.players[1]}
              units={playerUnits(game, 1)}
              isCurrent={game.currentPlayer === 1 && game.phase === 'map'}
              onItemClick={props.onItemClick}
            />
          </>
        )}
      </div>
    </section>
  );
}
