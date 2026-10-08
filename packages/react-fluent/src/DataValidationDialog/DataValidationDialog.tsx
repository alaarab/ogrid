
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, TabList, Tab } from '@fluentui/react-components';
import { DataValidationForm, useValidationDialogMotion, type DataValidationDialogProps, type ValidationTab } from '@alaarab/ogrid-react/data-validation';
import { useRef } from 'react';
import styles from './DataValidationDialog.module.scss';
/** Fluent modal and tabs, loaded only when validation needs a dialog. */
export default function DataValidationDialog(p: DataValidationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useValidationDialogMotion(dialogRef);
  return <Dialog open onOpenChange={(_e, data) => { if (!data.open) p.onClose(); }}>
    <DialogSurface ref={dialogRef} style={p.theme} className={styles.surface}>
      <style>{styles.__css}</style>
      <DialogBody>
        <DialogTitle>{p.alert?.title ?? 'Data validation'}</DialogTitle>
        <DialogContent>
          {p.alert ? <p className={styles.message}>{p.alert.message}</p> : <DataValidationForm {...p}
            renderTabs={(tab, change) => <TabList className={styles.tabs} selectedValue={tab} onTabSelect={(_e, data) => change(data.value as ValidationTab)}><Tab value="settings">Settings</Tab><Tab value="input">Input message</Tab><Tab value="error">Error alert</Tab></TabList>}
            renderActions={(clear) => <div className={styles.footer}><Button type="button" appearance="subtle" className={styles.clear} onClick={clear}>Clear all</Button><Button type="button" onClick={p.onClose}>Cancel</Button><Button type="submit" appearance="primary">Apply</Button></div>} />}
        </DialogContent>
        {p.alert && <DialogActions>{p.alert.style === 'warning' ? <><Button appearance="primary" onClick={() => p.onRespond(true)}>Accept value</Button><Button onClick={() => p.onRespond(false)}>Cancel</Button></> : <Button onClick={() => p.onRespond(false)}>OK</Button>}</DialogActions>}
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
