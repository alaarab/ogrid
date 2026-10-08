import { useState, type ElementType } from 'react';
import type { IColumnDef, IDataValidationRule, ICellValueChangedEvent } from '@alaarab/ogrid-react';
interface Row { id: number; quantity: number; status: string; description: string }
const initial = Array.from({ length: 40 }, (_, id): Row => ({ id, quantity: id === 0 || id === 2 ? 50 : 4, status: 'Open', description: `Order ${id + 1}` }));
const columns: IColumnDef<Row>[] = [
  { columnId: 'quantity', name: 'Quantity', type: 'numeric', editable: true, pinned: 'left', width: '180px' },
  { columnId: 'status', name: 'Status', editable: true, width: '400px' },
  { columnId: 'description', name: 'Description', editable: true, width: '700px' },
];
const initialRules: IDataValidationRule<Row>[] = [{ type: 'whole', columnIds: ['quantity'], operator: 'between', value: 1, value2: 10, inputMessage: { title: 'Quantity', text: 'Enter a whole number from 1 to 10.' } }, { type: 'list', columnIds: ['status'], values: ['Closed'] }];
/** Validation demo shared by the two example kits, with the docs demo's containment. */
export function ValidationExample({ Grid, lazyUi = false }: { Grid: ElementType; lazyUi?: boolean }) {
  const [data, setData] = useState(initial);
  const [rules, setRules] = useState(initialRules);
  return <div style={{ padding: 24 }}>
    <h1>Data validation</h1>
    <div style={{ contain: 'layout style', height: 360, display: 'flex', flexDirection: 'column' }}>
      <Grid columns={columns} data={data} getRowId={(row: Row) => row.id} editable defaultSortBy="" cellReferences
        dataValidations={rules} onDataValidationsChange={setRules} allowValidationEditing circleInvalidData frozenRows={1}
        findReplace formulas={lazyUi} rowDragging={lazyUi} rangeMove={lazyUi} allowFreeze={lazyUi}
        defaultCellNotes={lazyUi ? [{ rowId: 0, columnId: 'description', text: 'Consumer note' }] : undefined}
        virtualScroll={{ enabled: true, paginate: false, rowHeight: 36 }}
        onCellValueChanged={(e: ICellValueChangedEvent<Row>) => setData(prev => prev.map(row => row.id === e.item.id ? { ...row, [e.columnId]: e.newValue } : row))} />
    </div>
  </div>;
}
