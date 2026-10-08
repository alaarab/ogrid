
import { Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, Button, TabList, Tab } from '@fluentui/react-components';
import { DataValidationForm, type DataValidationDialogProps, type ValidationTab } from '@alaarab/ogrid-react/data-validation';
/** Fluent modal and tabs, loaded only when validation needs a dialog. */
export default function DataValidationDialog(p: DataValidationDialogProps) {
  return <Dialog open onOpenChange={(_e, data) => { if (!data.open) p.onClose(); }}>
    <DialogSurface style={p.theme}>
      <DialogBody>
        <DialogTitle>{p.alert?.title ?? 'Data validation'}</DialogTitle>
        <DialogContent>
          {p.alert ? <p>{p.alert.message}</p> : <DataValidationForm {...p}
            renderTabs={(tab, change) => <TabList selectedValue={tab} onTabSelect={(_e, data) => change(data.value as ValidationTab)}><Tab value="settings">Settings</Tab><Tab value="input">Input message</Tab><Tab value="error">Error alert</Tab></TabList>}
            renderActions={(clear) => <DialogActions><Button type="button" onClick={clear}>Clear all</Button><Button type="button" onClick={p.onClose}>Cancel</Button><Button type="submit" appearance="primary">Apply</Button></DialogActions>} />}
        </DialogContent>
        {p.alert && <DialogActions>{p.alert.style === 'warning' ? <><Button appearance="primary" onClick={() => p.onRespond(true)}>Accept value</Button><Button onClick={() => p.onRespond(false)}>Cancel</Button></> : <Button onClick={() => p.onRespond(false)}>OK</Button>}</DialogActions>}
      </DialogBody>
    </DialogSurface>
  </Dialog>;
}
