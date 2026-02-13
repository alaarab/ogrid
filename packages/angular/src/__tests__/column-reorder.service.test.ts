import { ColumnReorderService } from '../services/column-reorder.service';
import type { IColumnDef } from '../types';

type Row = { id: string; name: string };

const columns = [
  { columnId: 'id', name: 'ID' },
  { columnId: 'name', name: 'Name' },
  { columnId: 'status', name: 'Status' },
] as IColumnDef<Row>[];

describe('ColumnReorderService', () => {
  let service: ColumnReorderService<Row>;

  beforeEach(() => {
    service = new ColumnReorderService<Row>();
    service.columns.set(columns);
    service.enabled.set(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('is not dragging initially', () => {
    expect(service.isDragging()).toBe(false);
  });

  it('dropIndicatorX is null initially', () => {
    expect(service.dropIndicatorX()).toBeNull();
  });

  it('stores columns signal', () => {
    expect(service.columns()).toHaveLength(3);
    expect(service.columns().map((c) => c.columnId)).toEqual(['id', 'name', 'status']);
  });

  it('enabled signal can be toggled', () => {
    expect(service.enabled()).toBe(true);
    service.enabled.set(false);
    expect(service.enabled()).toBe(false);
  });

  it('columnOrder signal is undefined by default', () => {
    expect(service.columnOrder()).toBeUndefined();
  });

  it('columnOrder can be set', () => {
    service.columnOrder.set(['name', 'id', 'status']);
    expect(service.columnOrder()).toEqual(['name', 'id', 'status']);
  });

  it('onColumnOrderChange is undefined by default', () => {
    expect(service.onColumnOrderChange()).toBeUndefined();
  });

  it('onColumnOrderChange can be set to a callback', () => {
    const callback = jest.fn();
    service.onColumnOrderChange.set(callback);
    expect(service.onColumnOrderChange()).toBe(callback);
  });

  it('wrapperEl is null by default', () => {
    expect(service.wrapperEl()).toBeNull();
  });
});
