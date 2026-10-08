import { useState } from 'react';
import type { IColumnDef, IDataValidationRule, ICellValueChangedEvent } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
interface Row { id: number; product: string; quantity: number; status: string }
const initial: Row[] = [{ id: 1, product: 'Notebook', quantity: 4, status: 'Open' }, { id: 2, product: 'Pencil', quantity: 50, status: 'Closed' }, { id: 3, product: 'Folder', quantity: 2, status: 'Free text' }];
const columns: IColumnDef<Row>[] = [{ columnId: 'product', name: 'Product', editable: true }, { columnId: 'quantity', name: 'Quantity', editable: true, type: 'numeric' }, { columnId: 'status', name: 'Status', editable: true }];
const initialRules: IDataValidationRule<Row>[] = [
  { type: 'whole', columnIds: ['quantity'], operator: 'between', value: 1, value2: 10, inputMessage: { title: 'Quantity', text: 'Enter a whole number from 1 to 10.' }, errorAlert: { style: 'stop', title: 'Quantity', message: 'Choose a whole number from 1 to 10.' } },
  { type: 'list', columnIds: ['status'], rows: { start: 0, end: 1 }, values: ['Open', 'Closed'], errorAlert: { style: 'warning', title: 'Status', message: 'This status is outside the list. Keep it?' } },
];
function ValidationGrid() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  const [data, setData] = useState(initial);
  const [rules, setRules] = useState(initialRules);
  const [circle, setCircle] = useState(true);
  return <>
    <label style={{ display: 'block', marginBottom: 8 }}><input type="checkbox" checked={circle} onChange={(e) => setCircle(e.target.checked)} /> Circle invalid data</label>
    <OGrid columns={columns} data={data} getRowId={(r: Row) => r.id} editable defaultSortBy="" dataValidations={rules} onDataValidationsChange={(next: IDataValidationRule<Row>[]) => setRules(next)} allowValidationEditing circleInvalidData={circle}
      onCellValueChanged={(e: ICellValueChangedEvent<Row>) => setData((prev) => prev.map((r) => r.id === e.item.id ? { ...r, [e.columnId]: e.newValue } : r))} />
  </>;
}
export default function DataValidationDemo() {
  return <LiveDemo height={340} title="Edit quantities, choose a status from the first two cells, or select a range and right-click → Data validation…">{() => <ValidationGrid />}</LiveDemo>;
}
