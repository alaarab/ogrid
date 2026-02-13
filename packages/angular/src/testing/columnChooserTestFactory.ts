/**
 * Shared ColumnChooser tests for Angular UI packages.
 * Each UI package calls createColumnChooserTests(ColumnChooserComponent) to run these.
 *
 * Tests instantiate the component class directly and verify behavior.
 * Inputs use @Input() decorators (plain properties), internal state uses signals.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createColumnChooserTests(ColumnChooserComponent: new (...args: any[]) => any): void {
  const columns = [
    { columnId: 'a', name: 'Col A' },
    { columnId: 'b', name: 'Col B' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createComponent(overrides: Record<string, unknown> = {}): any {
    const instance = new ColumnChooserComponent();
    // Set @Input() properties directly
    instance.columns = overrides.columns ?? columns;
    instance.visibleColumns = overrides.visibleColumns ?? new Set(['a', 'b']);
    return instance;
  }

  it('instantiates with columns and visibleColumns', () => {
    const comp = createComponent();
    expect(comp).toBeTruthy();
    expect(comp.columns).toEqual(columns);
    expect(comp.visibleColumns).toEqual(new Set(['a', 'b']));
  });

  it('computes visibleCount and totalCount', () => {
    const comp = createComponent({ visibleColumns: new Set(['a']) });
    expect(comp.visibleCount()).toBe(1);
    expect(comp.totalCount()).toBe(2);
  });

  it('toggle opens and closes the dropdown', () => {
    const comp = createComponent();
    // Support both `isOpen` (Material/Radix) and `open` (PrimeNG) signal names
    const getOpen = () => (typeof comp.isOpen === 'function' ? comp.isOpen() : comp.open());
    expect(getOpen()).toBe(false);
    // Support both `toggle()` (Material/Radix) and manual toggle via `open.set(!)` (PrimeNG)
    if (typeof comp.toggle === 'function') {
      comp.toggle();
    } else {
      comp.open.set(!comp.open());
    }
    expect(getOpen()).toBe(true);
    if (typeof comp.toggle === 'function') {
      comp.toggle();
    } else {
      comp.open.set(!comp.open());
    }
    expect(getOpen()).toBe(false);
  });

  it('selectAll emits visibilityChange for hidden columns', () => {
    const comp = createComponent({ visibleColumns: new Set(['a']) });
    const emitted: Array<{ columnKey: string; visible: boolean }> = [];
    comp.visibilityChange.emit = (event: { columnKey: string; visible: boolean }) => emitted.push(event);
    // Support both `selectAll()` (Material/Radix) and `onSelectAll()` (PrimeNG)
    if (typeof comp.selectAll === 'function') {
      comp.selectAll();
    } else {
      comp.onSelectAll();
    }
    expect(emitted).toEqual([{ columnKey: 'b', visible: true }]);
  });

  it('clearAll emits visibilityChange for visible columns', () => {
    const comp = createComponent({ visibleColumns: new Set(['a', 'b']) });
    const emitted: Array<{ columnKey: string; visible: boolean }> = [];
    comp.visibilityChange.emit = (event: { columnKey: string; visible: boolean }) => emitted.push(event);
    // Support both `clearAll()` (Material/Radix) and `onClearAll()` (PrimeNG)
    if (typeof comp.clearAll === 'function') {
      comp.clearAll();
    } else {
      comp.onClearAll();
    }
    expect(emitted).toEqual([
      { columnKey: 'a', visible: false },
      { columnKey: 'b', visible: false },
    ]);
  });

  it('onCheckboxChange emits visibility event for specific column', () => {
    const comp = createComponent();
    const emitted: Array<{ columnKey: string; visible: boolean }> = [];
    comp.visibilityChange.emit = (event: { columnKey: string; visible: boolean }) => emitted.push(event);
    // Support both `onCheckboxChange(key, event)` (Material/Radix) and `onToggle(key, checked)` (PrimeNG)
    if (typeof comp.onCheckboxChange === 'function') {
      const event = { target: { checked: false } };
      comp.onCheckboxChange('a', event);
    } else {
      comp.onToggle('a', false);
    }
    expect(emitted).toEqual([{ columnKey: 'a', visible: false }]);
  });
}
