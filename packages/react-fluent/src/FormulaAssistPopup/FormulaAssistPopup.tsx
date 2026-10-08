import * as React from 'react';
import type { FormulaAssistPopupProps } from '@alaarab/ogrid-react';
import styles from './FormulaAssistPopup.module.scss';

/**
 * Fluent formula editing help: a function / named range listbox while a name
 * is typed, otherwise the argument hint for the call the caret is in.
 * Positioned and portaled by FormulaAssistHost; styled with Fluent v9 tokens (falling back to the grid's --ogrid-* tokens, which the portal carries).
 */
export function FormulaAssistPopup(props: FormulaAssistPopupProps): React.ReactElement | null {
  const { style, rootProps, listboxId, getOptionId, items, activeIndex, onSelect, onHover, hint, hintId } = props;
  const active = items[activeIndex];

  if (items.length > 0) {
    return (
      <div style={style} className={styles.popup} {...rootProps}>
        <div role="listbox" id={listboxId} aria-label="Formula suggestions" className={styles.list}>
          {items.map((item, i) => (
            // biome-ignore lint/a11y/useFocusableInteractive: options use the active-descendant pattern; the editor keeps focus and handles keys
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection is handled by the editor's onKeyDown (Up/Down, Tab, Enter)
            <div
              key={`${item.kind}:${item.name}`}
              id={getOptionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              className={i === activeIndex ? `${styles.option} ${styles.optionActive}` : styles.option}
              onClick={() => onSelect(i)}
              onMouseEnter={() => onHover(i)}
            >
              <span className={styles.kind} aria-hidden="true">{item.kind === 'function' ? 'fx' : 'N'}</span>
              <span className={styles.name}>{item.name}</span>
            </div>
          ))}
        </div>
        {active && (
          <div className={styles.details} aria-hidden="true">
            {active.signature && <div className={styles.signature}>{active.signature}</div>}
            <div className={styles.description}>{active.kind === 'name' ? `Named range: ${active.description}` : active.description}</div>
          </div>
        )}
      </div>
    );
  }

  if (!hint) return null;
  return (
    <div style={style} className={`${styles.popup} ${styles.hint}`} {...rootProps} role="tooltip" id={hintId}>
      {hint.parts.map((part, i) =>
        part.active ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and rebuilt each render
          <b key={i} className={styles.activeArg}>{part.text}</b>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts are positional and rebuilt each render
          <span key={i}>{part.text}</span>
        ),
      )}
    </div>
  );
}
