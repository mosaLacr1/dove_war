import type { ReactNode } from 'react';
import type { ItemId, PlayerId, TileKind } from '../core/types';

/** 统一的线条画底座：所有图形都用描边绘制，颜色由 CSS 的 currentColor 决定。 */
function Glyph({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`glyph ${className ?? ''}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function TileGlyph({ kind }: { kind: TileKind }) {
  switch (kind) {
    case 'wood':
      return (
        <Glyph className="glyph-wood">
          <rect x="5" y="8.5" width="22" height="7" rx="3.5" />
          <line x1="9" y1="12" x2="24" y2="12" />
          <rect x="5" y="16.5" width="22" height="7" rx="3.5" />
          <line x1="9" y1="20" x2="24" y2="20" />
          <circle cx="8.6" cy="12" r="1.4" />
          <circle cx="8.6" cy="20" r="1.4" />
        </Glyph>
      );
    case 'stone':
      return (
        <Glyph className="glyph-stone">
          <polygon points="7,21 9,11.5 20,8.5 26,15 23,22.5 11.5,24" />
          <line x1="12" y1="13" x2="18.5" y2="18" />
          <line x1="18.5" y1="18" x2="22.5" y2="13.5" />
        </Glyph>
      );
    case 'raw_iron_block':
      return (
        <Glyph className="glyph-iron">
          <rect x="6" y="9" width="20" height="14" rx="2.5" />
          <circle cx="11" cy="14" r="1.4" />
          <circle cx="17" cy="18.5" r="1.4" />
          <circle cx="21.5" cy="13.5" r="1.2" />
          <circle cx="19.5" cy="20" r="1" />
        </Glyph>
      );
    case 'gold_block':
      return (
        <Glyph className="glyph-gold">
          <rect x="6" y="9" width="20" height="14" rx="2.5" />
          <rect x="9.5" y="12" width="13" height="8" rx="1.2" />
          <line x1="9.5" y1="20" x2="16" y2="12" />
        </Glyph>
      );
    case 'diamond':
      return (
        <Glyph className="glyph-diamond">
          <polygon points="16,5 26,15 16,27 6,15" />
          <line x1="6" y1="15" x2="26" y2="15" />
          <line x1="16" y1="5" x2="11" y2="15" />
          <line x1="16" y1="5" x2="21" y2="15" />
        </Glyph>
      );
    default:
      return null;
  }
}

const PICKAXE = (
  <>
    <path d="M8 25l11-13" />
    <path d="M13 6c6 1 10 5 11 11-4-2-7-2-11 0-2-4-2-7 0-11z" />
  </>
);

const SWORD = (
  <>
    <path d="M23 7l3-2-1 4-12 12-3-3z" />
    <path d="M9 19l4 4" />
    <path d="M7 25l4-4" />
  </>
);

function armorShape(item: ItemId) {
  switch (item) {
    case 'iron_helmet':
      return (
        <>
          <path d="M9 20v-4a7 7 0 0 1 14 0v4" />
          <path d="M9 20h14" />
          <path d="M14 13h4" />
        </>
      );
    case 'iron_boots':
      return (
        <>
          <path d="M10 9h4v9l6 3v3H10z" />
          <path d="M14 18h6" />
        </>
      );
    case 'iron_leggings':
      return (
        <>
          <path d="M10 7h12v8l-4 10h-2l-1-6h-2l-1 6h-2z" />
        </>
      );
    default:
      return (
        <>
          <path d="M9 8l7-2 7 2v8c0 5-3 8-7 11-4-3-7-6-7-11z" />
          <path d="M16 6v20" />
        </>
      );
  }
}

export function ItemGlyph({ item }: { item: ItemId }) {
  switch (item) {
    case 'log':
      return (
        <Glyph className="glyph-wood">
          <rect x="5" y="10" width="22" height="12" rx="4" />
          <ellipse cx="9.5" cy="16" rx="2.6" ry="4" />
          <circle cx="9.5" cy="16" r="1" />
        </Glyph>
      );
    case 'planks':
      return (
        <Glyph className="glyph-wood">
          <rect x="5" y="7" width="22" height="5" rx="1" />
          <rect x="5" y="14" width="22" height="5" rx="1" />
          <rect x="5" y="21" width="22" height="5" rx="1" />
        </Glyph>
      );
    case 'stick':
      return (
        <Glyph className="glyph-wood">
          <path d="M9 25L23 7" />
          <path d="M7 23l4 4" />
        </Glyph>
      );
    case 'crafting_table':
      return (
        <Glyph className="glyph-wood">
          <rect x="5" y="8" width="22" height="16" rx="2" />
          <line x1="5" y1="16" x2="27" y2="16" />
          <line x1="12" y1="8" x2="12" y2="24" />
          <line x1="20" y1="8" x2="20" y2="24" />
        </Glyph>
      );
    case 'cobblestone':
      return (
        <Glyph className="glyph-stone">
          <path d="M6 18c0-3 2-6 6-6s6 3 6 6-2 5-6 5-6-2-6-5z" />
          <path d="M17 22c0-3 2-5 5-5s5 2 5 5-2 4-5 4-5-1-5-4z" />
        </Glyph>
      );
    case 'stone':
      return (
        <Glyph className="glyph-stone">
          <rect x="6" y="9" width="20" height="15" rx="2" />
          <line x1="6" y1="15" x2="26" y2="15" />
        </Glyph>
      );
    case 'furnace':
      return (
        <Glyph className="glyph-stone">
          <rect x="6" y="7" width="20" height="19" rx="2" />
          <rect x="11" y="15" width="10" height="7" rx="1" />
          <line x1="11" y1="11" x2="21" y2="11" />
        </Glyph>
      );
    case 'raw_iron':
      return (
        <Glyph className="glyph-iron">
          <path d="M8 20l3-7 7-3 6 5-2 8-8 2z" />
          <circle cx="13" cy="15" r="1.1" />
          <circle cx="19" cy="18" r="1.1" />
        </Glyph>
      );
    case 'raw_iron_block':
    case 'gold_block':
      return (
        <Glyph className={item === 'gold_block' ? 'glyph-gold' : 'glyph-iron'}>
          <rect x="6" y="9" width="20" height="14" rx="2" />
          <rect x="10" y="13" width="12" height="6" rx="1" />
        </Glyph>
      );
    case 'iron_ingot':
    case 'gold_ingot':
      return (
        <Glyph className={item === 'gold_ingot' ? 'glyph-gold' : 'glyph-iron'}>
          <path d="M9 21l3-10h10l3 10z" />
          <line x1="11.5" y1="17" x2="22.5" y2="17" />
        </Glyph>
      );
    case 'diamond':
      return (
        <Glyph className="glyph-diamond">
          <polygon points="16,5 26,15 16,27 6,15" />
          <line x1="6" y1="15" x2="26" y2="15" />
        </Glyph>
      );
    case 'wooden_pickaxe':
    case 'stone_pickaxe':
    case 'iron_pickaxe':
      return (
        <Glyph className={item === 'iron_pickaxe' ? 'glyph-iron' : item === 'stone_pickaxe' ? 'glyph-stone' : 'glyph-wood'}>
          {PICKAXE}
        </Glyph>
      );
    case 'wooden_sword':
    case 'stone_sword':
    case 'iron_sword':
    case 'diamond_sword':
      return (
        <Glyph className={item === 'diamond_sword' ? 'glyph-diamond' : item === 'iron_sword' ? 'glyph-iron' : item === 'stone_sword' ? 'glyph-stone' : 'glyph-wood'}>
          {SWORD}
        </Glyph>
      );
    case 'iron_helmet':
    case 'iron_chestplate':
    case 'iron_leggings':
    case 'iron_boots':
      return <Glyph className="glyph-iron">{armorShape(item)}</Glyph>;
    case 'shield':
      return (
        <Glyph className="glyph-iron">
          <path d="M16 4l11 3.6V16c0 6.6-4.6 10.8-11 13.2C9.6 26.8 5 22.6 5 16V7.6z" />
          <path d="M16 9.5v13" />
          <path d="M9.6 13.6h12.8" />
        </Glyph>
      );
    default:
      return <Glyph>{<rect x="8" y="8" width="16" height="16" rx="3" />}</Glyph>;
  }
}

export function DoveGlyph({ owner, className }: { owner: PlayerId; className?: string }) {
  return (
    <svg
      className={`glyph dove-glyph ${owner === 0 ? 'dove-p1' : 'dove-p2'} ${className ?? ''}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <ellipse cx="15" cy="19" rx="8" ry="5.5" />
      <circle cx="22.5" cy="12" r="3.4" />
      <polygon points="25.5,11 29.5,12.4 25.5,13.8" />
      <path d="M11 16c-2.5 1-4 3-4.5 5.5" />
      <path d="M8 22l-4 2.5 1.5-4.5" />
      <path d="M13 20c1.5 1.5 4 2 6 1" />
    </svg>
  );
}
