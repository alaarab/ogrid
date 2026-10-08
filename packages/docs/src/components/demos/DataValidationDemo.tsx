import { useState, lazy, Suspense } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import type { IColumnDef, IDataValidationRule, ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
interface Row { id: number; product: string; quantity: number; status: string }
const initial: Row[] = [{ id: 1, product: 'Notebook', quantity: 4, status: 'Open' }, { id: 2, product: 'Pencil', quantity: 50, status: 'Closed' }, { id: 3, product: 'Folder', quantity: 2, status: 'Free text' }];
const columns: IColumnDef<Row>[] = [{ columnId: 'product', name: 'Product', editable: true }, { columnId: 'quantity', name: 'Quantity', editable: true, type: 'numeric' }, { columnId: 'status', name: 'Status', editable: true }];
const initialRules: IDataValidationRule<Row>[] = [
  { type: 'whole', columnIds: ['quantity'], operator: 'between', value: 1, value2: 10, allowBlank: false, inputMessage: { title: 'Quantity', text: 'Enter a whole number from 1 to 10.' }, errorAlert: { style: 'stop', title: 'Quantity', message: 'Choose a whole number from 1 to 10.' } },
  { type: 'list', columnIds: ['status'], rows: { start: 0, end: 1 }, values: ['Open', 'Closed'], errorAlert: { style: 'warning', title: 'Status', message: 'This status is outside the list. Keep it?' } },
];
function ValidationGrid({ kit }: { kit: 'radix' | 'fluent' }) {
  const { OGrid } = (kit === 'radix' ? require('@alaarab/ogrid-react-radix') : require('@alaarab/ogrid-react-fluent')) as typeof import('@alaarab/ogrid-react-radix');
  const [data, setData] = useState(initial);
  const [rules, setRules] = useState(initialRules);
  const [circle, setCircle] = useState(true);
  return <>
    <div className="live-demo__controls"><label><input type="checkbox" checked={circle} onChange={(e) => setCircle(e.target.checked)} /> Circle invalid data</label></div>
    <OGrid columns={columns} data={data} getRowId={(r: Row) => r.id} editable defaultSortBy="" dataValidations={rules} onDataValidationsChange={(next: IDataValidationRule<Row>[]) => setRules(next)} allowValidationEditing circleInvalidData={circle} findReplace
      onCellValueChanged={(e: ICellValueChangedEvent<Row>) => setData((prev) => prev.map((r) => r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r))} />
  </>;
}
// Docusaurus theme hooks belong to the optional Fluent preview, not the Radix demo.
const FluentValidationGrid = lazy(async () => {
  const { useColorMode } = await import('@docusaurus/theme-common');
  return { default: function FluentValidationGrid() {
    const { colorMode } = useColorMode();
    return <FluentProvider theme={colorMode === 'dark' ? webDarkTheme : webLightTheme}><ValidationGrid kit="fluent" /></FluentProvider>;
  } };
});
function Demo() {
  const [kit, setKit] = useState<'radix' | 'fluent'>('radix');
  return <>
    <div className="live-demo__controls"><label>UI kit <select aria-label="UI kit" value={kit} onChange={e => setKit(e.target.value as typeof kit)}><option value="radix">Radix</option><option value="fluent">Fluent</option></select></label></div>
    {kit === 'fluent' ? <Suspense fallback={null}><FluentValidationGrid /></Suspense> : <ValidationGrid kit="radix" />}
  </>;
}
export default function DataValidationDemo() {
  return <LiveDemo height={400} title="Edit quantities, choose a status from the first two cells, or select a range and right-click → Data validation…">{() => <Demo />}</LiveDemo>;
}
