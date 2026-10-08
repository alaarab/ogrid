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
      <style>{WORKBOOK_TABS_CSS}</style>
      {sheetNames.map((name, index) => {
        const isActive = name === active;
        return (
          <button
            key={name}
            ref={(el) => { if (el) tabRefs.current.set(name, el); else tabRefs.current.delete(name); }}
            id={`${idBase}-tab-${index}`}
            className="ogrid-workbook-tab"
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
  gap: 4,
  padding: '4px 8px 0',
  background: 'var(--ogrid-header-bg, #f5f5f5)',
  borderBottom: '1px solid var(--ogrid-border, #e0e0e0)',
  overflowX: 'auto',
  flex: '0 0 auto',
};

const tabBase: React.CSSProperties = {
  borderWidth: '1px 1px 0',
  borderStyle: 'solid',
  borderColor: 'var(--ogrid-border, #e0e0e0)',
  borderRadius: '4px 4px 0 0',
  padding: '4px 12px',
  fontSize: 13,
  minHeight: 32,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  fontFamily: 'inherit',
};
const tabStyle: React.CSSProperties = {
  ...tabBase,
  background: 'transparent',
  color: 'var(--ogrid-muted, #616161)',
};
const tabActiveStyle: React.CSSProperties = {
  ...tabBase,
  background: 'var(--ogrid-bg, #fff)',
  color: 'var(--ogrid-primary, #217346)',
  borderColor: 'var(--ogrid-primary, #217346)',
};

const WORKBOOK_TABS_CSS = `.ogrid-workbook-tab:focus-visible{outline:2px solid var(--ogrid-ring);outline-offset:-2px}.ogrid-workbook-tab:hover{box-shadow:inset 0 0 0 32px var(--ogrid-hover-bg)}`;
