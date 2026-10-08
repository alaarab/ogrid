import * as React from 'react';
import * as Checkbox from '@radix-ui/react-checkbox';
import { useFindReplacePanel } from '@alaarab/ogrid-react';
import type { FindReplacePanelProps, IFindOptions } from '@alaarab/ogrid-react';
import styles from './FindReplacePanel.module.scss';

function OptionCheckbox({ id, label, checked, onChange }: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className={styles.option}>
      <Checkbox.Root id={id} className={styles.checkbox} checked={checked} onCheckedChange={(c: boolean | 'indeterminate') => onChange(c === true)}>
        <Checkbox.Indicator className={styles.checkboxIndicator}>✓</Checkbox.Indicator>
      </Checkbox.Root>
      <label htmlFor={id}>{label}</label>
    </span>
  );
}

/** Radix Find & Replace panel: floats at the grid's top-right (Ctrl+F / Ctrl+H). */
export function FindReplacePanel(props: FindReplacePanelProps): React.ReactElement {
  const { find, onClose } = props;
  const { findInputRef, replaceInputRef, idPrefix, onPanelKeyDown, onFindKeyDown, onReplaceKeyDown } = useFindReplacePanel(props);
  const [showOptions, setShowOptions] = React.useState(false);
  const { mode, options, setOptions, canReplace } = find;
  const isReplace = mode === 'replace';
  const hasMatches = find.matches.length > 0;
  const set = (partial: Partial<IFindOptions>) => setOptions(partial);

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: the search landmark hosts the panel's shortcuts (Escape, Ctrl+F, Ctrl+H) for every control inside it
    // biome-ignore lint/a11y/useSemanticElements: <search> is too new for React 17/18 typings and older browsers; role="search" carries the same landmark
    <div role="search" aria-label="Find and replace" className={styles.panel} onKeyDown={onPanelKeyDown}>
      <div className={styles.row}>
        {canReplace && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Toggle replace"
            aria-expanded={isReplace}
            onClick={() => find.setMode(isReplace ? 'find' : 'replace')}
          >
            {isReplace ? '▾' : '▸'}
          </button>
        )}
        <input
          ref={findInputRef}
          type="text"
          className={styles.input}
          aria-label="Find"
          placeholder="Find"
          value={find.query}
          onChange={(e) => find.setQuery(e.target.value)}
          onKeyDown={onFindKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <span className={styles.status} role="status" aria-live="polite" aria-atomic="true">
          {find.statusText}
        </span>
        <button type="button" className={styles.iconButton} aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!hasMatches} onClick={find.prev}>↑</button>
        <button type="button" className={styles.iconButton} aria-label="Next match" title="Next match (Enter)" disabled={!hasMatches} onClick={find.next}>↓</button>
        <button
          type="button"
          className={`${styles.iconButton} ${showOptions ? styles.iconButtonActive : ''}`}
          aria-label="Search options"
          aria-expanded={showOptions}
          aria-controls={`${idPrefix}-options`}
          onClick={() => setShowOptions((v) => !v)}
        >
          ⋯
        </button>
        <button type="button" className={styles.iconButton} aria-label="Close" title="Close (Escape)" onClick={onClose}>✕</button>
      </div>
      {isReplace && (
        <div className={styles.row}>
          {canReplace && <span className={styles.indent} aria-hidden />}
          <input
            ref={replaceInputRef}
            type="text"
            className={styles.input}
            aria-label="Replace with"
            placeholder="Replace with"
            value={find.replacement}
            onChange={(e) => find.setReplacement(e.target.value)}
            onKeyDown={onReplaceKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className={styles.button} disabled={!hasMatches} onClick={() => { find.replace(); }}>Replace</button>
          <button type="button" className={styles.button} disabled={!hasMatches} onClick={() => { find.replaceAll(); }}>Replace all</button>
        </div>
      )}
      {showOptions && (
        <div className={styles.options} id={`${idPrefix}-options`}>
          <OptionCheckbox id={`${idPrefix}-case`} label="Match case" checked={options.matchCase} onChange={(c) => set({ matchCase: c })} />
          <OptionCheckbox id={`${idPrefix}-entire`} label="Match entire cell contents" checked={options.matchEntireCell} onChange={(c) => set({ matchEntireCell: c })} />
          <OptionCheckbox id={`${idPrefix}-selection`} label="Within selection" checked={options.scope === 'selection'} onChange={(c) => set({ scope: c ? 'selection' : 'grid' })} />
          <span className={styles.option}>
            <label htmlFor={`${idPrefix}-order`}>Search</label>
            <select id={`${idPrefix}-order`} aria-label="Search order" className={styles.select} value={options.searchOrder} onChange={(e) => set({ searchOrder: e.target.value as IFindOptions['searchOrder'] })}>
              <option value="byRows">By rows</option>
              <option value="byColumns">By columns</option>
            </select>
          </span>
          <span className={styles.option}>
            <label htmlFor={`${idPrefix}-lookin`}>Look in</label>
            <select id={`${idPrefix}-lookin`} className={styles.select} value={options.lookIn} onChange={(e) => set({ lookIn: e.target.value as IFindOptions['lookIn'] })}>
              <option value="values">Values</option>
              <option value="formulas">Formulas</option>
            </select>
          </span>
        </div>
      )}
    </div>
  );
}
