import { useRef } from 'react';

/** Shared WAI-ARIA sheet tabs for the loaded editor and progressive preview. */
export function WorkbookSheetTabs({ sheetNames, active, onSelect, idBase, tabColors }: {
  sheetNames: string[];
  active: string;
  onSelect: (name: string) => void;
  idBase: string;
  tabColors?: Map<string, string | undefined>;
}) {
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = sheetNames.length - 1;
    const next = event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last : -1;
    const name = sheetNames[next];
    if (!name) return;
    event.preventDefault();
    onSelect(name);
    tabRefs.current.get(name)?.focus();
  };
  if (sheetNames.length < 2) return null;
  return (
    <div role="tablist" aria-label="Workbook sheets" style={tabsStyle}>
      {sheetNames.map((name, index) => {
        const isActive = name === active;
        return (
          <button
            key={name}
            ref={(el) => { if (el) tabRefs.current.set(name, el); else tabRefs.current.delete(name); }}
            id={`${idBase}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`${idBase}-panel`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(name)}
            onKeyDown={(event) => onKeyDown(event, index)}
            style={{
              ...(isActive ? tabActiveStyle : tabStyle),
              ...(tabColors?.get(name) ? { boxShadow: `inset 0 -3px 0 ${tabColors.get(name)}` } : {}),
            }}
          >{name}</button>
        );
      })}
    </div>
  );
}

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 2,
  padding: '6px 8px 0',
  background: 'var(--bg-3, #1b2330)',
  borderBottom: '1px solid var(--border, #1f2a3a)',
  overflowX: 'auto',
  flex: '0 0 auto',
};

const tabBase: React.CSSProperties = {
  borderWidth: '1px 1px 0',
  borderStyle: 'solid',
  borderColor: 'var(--border, #1f2a3a)',
  borderRadius: '4px 4px 0 0',
  padding: '4px 12px',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
const tabStyle: React.CSSProperties = {
  ...tabBase,
  background: 'var(--bg-2, #121821)',
  color: 'var(--fg-dim, #8a96a6)',
};
const tabActiveStyle: React.CSSProperties = {
  ...tabBase,
  background: 'var(--bg, #0b1014)',
  color: 'var(--accent, #3cb87a)',
  borderColor: 'var(--accent, #3cb87a)',
};
