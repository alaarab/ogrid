import * as React from 'react';
import { createPortal } from 'react-dom';
import { DataValidationForm, type DataValidationDialogProps, type ValidationTab } from '@alaarab/ogrid-react/data-validation';
import styles from '../DataGridTable/DataGridTable.module.scss';
let dialogCounter = 0;
const tabs: { value: ValidationTab; label: string }[] = [{ value: 'settings', label: 'Settings' }, { value: 'input', label: 'Input message' }, { value: 'error', label: 'Error alert' }];
// Modal-only rules travel with the lazy UI, like the XLSX toolbar styles.
const MODAL_CSS = '.ogrid-validation-dialog::backdrop{background:#0007}.ogrid-validation-dialog :focus-visible{outline:2px solid var(--ogrid-selection-color,#217346)}';
/** Modal Radix surface, loaded only when validation needs a dialog. */
export default function DataValidationDialog(p: DataValidationDialogProps) {
  const [titleId] = React.useState(() => `ogrid-validation-${++dialogCounter}`);
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  React.useLayoutEffect(() => { dialogRef.current?.showModal(); }, []);
  return createPortal(
      <dialog ref={dialogRef} aria-labelledby={titleId} className={`${styles.cellNote} ogrid-validation-dialog`} style={{ ...p.theme, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)', padding: 20, overflow: 'auto' }}
        onCancel={e => { e.preventDefault(); p.onClose(); }}
        onPointerDown={e => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) p.onClose();
        }}>
        <style>{MODAL_CSS}</style>
        <h2 id={titleId} style={{ marginTop: 0 }}>{p.alert?.title ?? 'Data validation'}</h2>
        {p.alert ? <>
          <p>{p.alert.message}</p>
          <div className={styles.cellNoteActions}>{p.alert.style === 'warning' ? <><button type="button" className={`${styles.cellNoteButton} ${styles.cellNoteButtonPrimary}`} onClick={() => p.onRespond(true)}>Accept value</button><button type="button" className={styles.cellNoteButton} onClick={() => p.onRespond(false)}>Cancel</button></> : <button type="button" className={styles.cellNoteButton} onClick={() => p.onRespond(false)}>OK</button>}</div>
        </> : <DataValidationForm {...p} renderTabs={(tab, change) => <div role="tablist" aria-label="Validation settings" style={{ display: 'flex', gap: 4 }}>{tabs.map((t) => <button type="button" key={t.value} role="tab" className={`${styles.cellNoteButton} ${tab === t.value ? styles.cellNoteButtonPrimary : ''}`} aria-selected={tab === t.value} onClick={() => change(t.value)}>{t.label}</button>)}</div>}
          renderActions={(clear) => <div className={styles.cellNoteActions}><button type="button" className={styles.cellNoteButton} onClick={clear}>Clear all</button><button type="button" className={styles.cellNoteButton} onClick={p.onClose}>Cancel</button><button type="submit" className={`${styles.cellNoteButton} ${styles.cellNoteButtonPrimary}`}>Apply</button></div>} />}
      </dialog>, document.body);
}
