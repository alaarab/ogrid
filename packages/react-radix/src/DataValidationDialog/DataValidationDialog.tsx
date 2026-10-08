import * as React from 'react';
import { createPortal } from 'react-dom';
import { DataValidationForm, useValidationDialogMotion, type DataValidationDialogProps, type ValidationTab } from '@alaarab/ogrid-react/data-validation';
import styles from '../DataGridTable/DataGridTable.module.scss';
import dialogStyles from './DataValidationDialog.module.scss';
let dialogCounter = 0;
const tabs: { value: ValidationTab; label: string }[] = [{ value: 'settings', label: 'Settings' }, { value: 'input', label: 'Input message' }, { value: 'error', label: 'Error alert' }];

/** Modal Radix surface, loaded only when validation needs a dialog. */
export default function DataValidationDialog(p: DataValidationDialogProps) {
  const [titleId] = React.useState(() => `ogrid-validation-${++dialogCounter}`);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  useValidationDialogMotion(dialogRef);
  React.useLayoutEffect(() => { dialogRef.current?.showModal(); }, []);
  return createPortal(
      <dialog ref={dialogRef} aria-labelledby={titleId} className={`${dialogStyles.dialog} ogrid-validation-dialog`} style={p.theme} data-alert-style={p.alert?.style}
        onCancel={e => { e.preventDefault(); p.onClose(); }}
        onPointerDown={e => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) p.onClose();
        }}>
        <style>{dialogStyles.__css}</style>
        <h2 id={titleId} className={dialogStyles.title}>{p.alert?.title ?? 'Data validation'}</h2>
        {p.alert ? <>
          <p className={dialogStyles.message}>{p.alert.message}</p>
          <div className={dialogStyles.footer}>{p.alert.style === 'warning' ? <><button type="button" className={`${styles.cellNoteButton} ${styles.cellNoteButtonPrimary}`} onClick={() => p.onRespond(true)}>Accept value</button><button type="button" className={styles.cellNoteButton} onClick={() => p.onRespond(false)}>Cancel</button></> : <button type="button" className={styles.cellNoteButton} onClick={() => p.onRespond(false)}>OK</button>}</div>
        </> : <DataValidationForm {...p} renderTabs={(tab, change) => <div role="tablist" aria-label="Validation settings" className={dialogStyles.tabs}>{tabs.map((t) => <button type="button" key={t.value} role="tab" className={dialogStyles.tab} aria-selected={tab === t.value} onClick={() => change(t.value)}>{t.label}</button>)}</div>}
          renderActions={(clear) => <div className={dialogStyles.footer}><button type="button" className={`${styles.cellNoteButton} ${dialogStyles.clear}`} onClick={clear}>Clear all</button><button type="button" className={styles.cellNoteButton} onClick={p.onClose}>Cancel</button><button type="submit" className={`${styles.cellNoteButton} ${styles.cellNoteButtonPrimary}`}>Apply</button></div>} />}
      </dialog>, document.body);
}
