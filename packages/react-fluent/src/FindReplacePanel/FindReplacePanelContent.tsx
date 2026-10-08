import * as React from 'react';
import { Button, Checkbox, Input, Select, Text } from '@fluentui/react-components';
import {
  ArrowDownRegular,
  ArrowUpRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  DismissRegular,
  MoreHorizontalRegular,
} from '@fluentui/react-icons';
import { useFindReplacePanel } from '@alaarab/ogrid-react';
import type { FindReplacePanelProps, IFindOptions } from '@alaarab/ogrid-react';
import styles from './FindReplacePanel.module.scss';

/** Fluent Find & Replace panel: floats at the grid's top-right (Ctrl+F / Ctrl+H). */
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
          <Button
            appearance="subtle"
            size="small"
            icon={isReplace ? <ChevronDownRegular /> : <ChevronRightRegular />}
            aria-label="Toggle replace"
            aria-expanded={isReplace}
            onClick={() => find.setMode(isReplace ? 'find' : 'replace')}
          />
        )}
        <Input
          ref={findInputRef}
          className={styles.input}
          size="small"
          aria-label="Find"
          placeholder="Find"
          value={find.query}
          onChange={(_e, data) => find.setQuery(data.value)}
          onKeyDown={onFindKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <Text size={200} className={styles.status} role="status" aria-live="polite" aria-atomic="true">
          {find.statusText}
        </Text>
        <Button appearance="subtle" size="small" icon={<ArrowUpRegular />} aria-label="Previous match" title="Previous match (Shift+Enter)" disabled={!hasMatches} onClick={find.prev} />
        <Button appearance="subtle" size="small" icon={<ArrowDownRegular />} aria-label="Next match" title="Next match (Enter)" disabled={!hasMatches} onClick={find.next} />
        <Button
          appearance={showOptions ? 'secondary' : 'subtle'}
          size="small"
          icon={<MoreHorizontalRegular />}
          aria-label="Search options"
          aria-expanded={showOptions}
          aria-controls={`${idPrefix}-options`}
          onClick={() => setShowOptions((v) => !v)}
        />
        <Button appearance="subtle" size="small" icon={<DismissRegular />} aria-label="Close" title="Close (Escape)" onClick={onClose} />
      </div>
      {isReplace && (
        <div className={styles.row}>
          {canReplace && <span className={styles.indent} aria-hidden />}
          <Input
            ref={replaceInputRef}
            className={styles.input}
            size="small"
            aria-label="Replace with"
            placeholder="Replace with"
            value={find.replacement}
            onChange={(_e, data) => find.setReplacement(data.value)}
            onKeyDown={onReplaceKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <Button size="small" disabled={!hasMatches} onClick={() => { find.replace(); }}>Replace</Button>
          <Button size="small" disabled={!hasMatches} onClick={() => { find.replaceAll(); }}>Replace all</Button>
        </div>
      )}
      {showOptions && (
        <div className={styles.options} id={`${idPrefix}-options`}>
          <Checkbox size="medium" label="Match case" checked={options.matchCase} onChange={(_e, data) => set({ matchCase: data.checked === true })} />
          <Checkbox size="medium" label="Match entire cell contents" checked={options.matchEntireCell} onChange={(_e, data) => set({ matchEntireCell: data.checked === true })} />
          <Checkbox size="medium" label="Within selection" checked={options.scope === 'selection'} onChange={(_e, data) => set({ scope: data.checked === true ? 'selection' : 'grid' })} />
          <Select size="small" aria-label="Search order" value={options.searchOrder} onChange={(_e, data) => set({ searchOrder: data.value as IFindOptions['searchOrder'] })}>
            <option value="byRows">By rows</option>
            <option value="byColumns">By columns</option>
          </Select>
          <Select size="small" aria-label="Look in" value={options.lookIn} onChange={(_e, data) => set({ lookIn: data.value as IFindOptions['lookIn'] })}>
            <option value="values">Values</option>
            <option value="formulas">Formulas</option>
          </Select>
        </div>
      )}
    </div>
  );
}
