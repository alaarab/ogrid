import { validateColumns } from '../validation';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: string;
  name: string;
}

describe('validateColumns — editable column validation', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Ensure development mode so the editable warning fires
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('warns when editable=true and no cellEditor is defined', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true },
    ];
    validateColumns(columns);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('editable=true but no cellEditor')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"name"')
    );
  });

  it('does not warn when editable=true and cellEditor is defined', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
    ];
    validateColumns(columns);
    const editableWarning = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('editable=true but no cellEditor')
    );
    expect(editableWarning).toBeUndefined();
  });

  it('does not warn when editable=false and no cellEditor', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: false },
    ];
    validateColumns(columns);
    const editableWarning = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('editable=true but no cellEditor')
    );
    expect(editableWarning).toBeUndefined();
  });

  it('does not warn when editable is undefined and no cellEditor', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name' },
    ];
    validateColumns(columns);
    const editableWarning = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('editable=true but no cellEditor')
    );
    expect(editableWarning).toBeUndefined();
  });

  it('warns for each column missing cellEditor when editable=true', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true },
      { columnId: 'id', name: 'ID', editable: true },
    ];
    validateColumns(columns);
    const editableWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('editable=true but no cellEditor')
    );
    expect(editableWarnings).toHaveLength(2);
  });

  it('only warns for columns without cellEditor when mixed', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
      { columnId: 'id', name: 'ID', editable: true },
    ];
    validateColumns(columns);
    const editableWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('editable=true but no cellEditor')
    );
    expect(editableWarnings).toHaveLength(1);
    expect(editableWarnings[0][0]).toContain('"id"');
  });

  it('warns for empty columns array', () => {
    validateColumns([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('columns prop is empty or not an array')
    );
  });

  it('warns for duplicate columnId', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name' },
      { columnId: 'name', name: 'Name 2' },
    ];
    validateColumns(columns);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate columnId')
    );
  });

  it('warns for column missing columnId', () => {
    const columns = [
      { columnId: '', name: 'Name' } as IColumnDef<Row>,
    ];
    validateColumns(columns);
    // console.warn is called with two args: the message string + the col object
    const call = warnSpy.mock.calls.find((c) => String(c[0]).includes('Column missing columnId'));
    expect(call).toBeDefined();
  });
});
