import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DataValidationForm, type DataValidationDialogProps, type ValidationTab } from '@alaarab/ogrid-react/data-validation';
let dialogCounter = 0;
const tabs: { value: ValidationTab; label: string }[] = [{ value: 'settings', label: 'Settings' }, { value: 'input', label: 'Input message' }, { value: 'error', label: 'Error alert' }];
/** Modal Radix surface, loaded only when validation needs a dialog. */
export default function DataValidationDialog(p: DataValidationDialogProps) {
  const [titleId] = React.useState(() => `ogrid-validation-${++dialogCounter}`);
  const anchor = React.useMemo(() => ({ current: { getBoundingClientRect: () => new DOMRect(window.innerWidth / 2, window.innerHeight * 0.15, 0, 0) } }), []);
  return <Popover.Root open modal onOpenChange={(open) => { if (!open) p.onClose(); }}>
    <Popover.Anchor virtualRef={anchor} />
    <Popover.Portal>
      <Popover.Content role="dialog" aria-labelledby={titleId} align="center" side="bottom" collisionPadding={12} style={{ maxHeight: '70vh', overflowY: 'auto', padding: 20, borderRadius: 6, background: 'var(--ogrid-bg, white)', color: 'var(--ogrid-fg, #242424)', border: '1px solid var(--ogrid-border, #bbb)', boxShadow: '0 8px 40px #0005', zIndex: 10005, font: '14px sans-serif' }}>
        <h2 id={titleId} style={{ marginTop: 0 }}>{p.alert?.title ?? 'Data validation'}</h2>
        {p.alert ? <>
          <p>{p.alert.message}</p>
          {p.alert.style === 'warning' ? <><button type="button" onClick={() => p.onRespond(true)}>Accept value</button>{' '}<button type="button" onClick={() => p.onRespond(false)}>Cancel</button></> : <button type="button" onClick={() => p.onRespond(false)}>OK</button>}
        </> : <DataValidationForm {...p} renderTabs={(tab, change) => <div role="tablist" aria-label="Validation settings" style={{ display: 'flex', gap: 4 }}>{tabs.map((t) => <button type="button" key={t.value} role="tab" aria-selected={tab === t.value} onClick={() => change(t.value)}>{t.label}</button>)}</div>}
          renderActions={(clear) => <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}><button type="button" onClick={clear}>Clear all</button><button type="button" onClick={p.onClose}>Cancel</button><button type="submit">Apply</button></div>} />}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
