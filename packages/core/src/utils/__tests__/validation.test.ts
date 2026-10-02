import { validateColumns } from '../validation';
import type { IColumnDef } from '../../types/columnTypes';

interface Row {
  id: string;
  name: string;
}

describe('validateColumns  -  column validation', () => {
  let warnSpy: jest.SpyInstance;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Ensure development mode so the dev-only warnings fire
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    warnSpy.mockRestore();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not warn when editable=true and no cellEditor is defined (falls back to the default editor)', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true },
    ];
    validateColumns(columns);
    const editableWarning = warnSpy.mock.calls.find((c) =>
      String(c[0]).includes('cellEditor')
    );
    expect(editableWarning).toBeUndefined();
  });

  it('does not warn when editable=true and cellEditor is defined', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name', editable: true, cellEditor: 'text' },
    ];
    validateColumns(columns);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns for empty columns array', () => {
    validateColumns([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('columns prop is empty or not an array')
    );
  });

  it('warns for duplicate columnId in development', () => {
    const columns: IColumnDef<Row>[] = [
      { columnId: 'name', name: 'Name' },
      { columnId: 'name', name: 'Name 2' },
    ];
    validateColumns(columns);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate columnId')
    );
  });

  it('warns for column missing columnId in development', () => {
    const columns = [
      { columnId: '', name: 'Name' } as IColumnDef<Row>,
    ];
    validateColumns(columns);
    // console.warn is called with two args: the message string + the col object
    const call = warnSpy.mock.calls.find((c) => String(c[0]).includes('Column missing columnId'));
    expect(call).toBeDefined();
  });

  it('suppresses missing/duplicate columnId warnings in production', () => {
    process.env.NODE_ENV = 'production';
    const columns: IColumnDef<Row>[] = [
      { columnId: '', name: 'Missing' },
      { columnId: 'name', name: 'Name' },
      { columnId: 'name', name: 'Name 2' },
    ];
    validateColumns(columns);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
