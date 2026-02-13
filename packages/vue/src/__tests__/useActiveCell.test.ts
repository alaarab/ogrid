import { useActiveCell } from '../composables/useActiveCell';

describe('useActiveCell', () => {
  it('initializes activeCell as null', () => {
    const { activeCell } = useActiveCell();
    expect(activeCell.value).toBeNull();
  });

  it('setActiveCell updates the active cell', () => {
    const { activeCell, setActiveCell } = useActiveCell();
    setActiveCell({ rowIndex: 1, columnIndex: 2 });
    expect(activeCell.value).toEqual({ rowIndex: 1, columnIndex: 2 });
  });

  it('setActiveCell to null clears the active cell', () => {
    const { activeCell, setActiveCell } = useActiveCell();
    setActiveCell({ rowIndex: 0, columnIndex: 0 });
    setActiveCell(null);
    expect(activeCell.value).toBeNull();
  });

  it('deduplicates when same coordinates are set', () => {
    const { activeCell, setActiveCell } = useActiveCell();
    setActiveCell({ rowIndex: 1, columnIndex: 2 });
    const first = activeCell.value;
    setActiveCell({ rowIndex: 1, columnIndex: 2 });
    // Should be the same reference (deduped)
    expect(activeCell.value).toBe(first);
  });

  it('updates when coordinates actually change', () => {
    const { activeCell, setActiveCell } = useActiveCell();
    setActiveCell({ rowIndex: 1, columnIndex: 2 });
    const first = activeCell.value;
    setActiveCell({ rowIndex: 2, columnIndex: 3 });
    expect(activeCell.value).not.toBe(first);
    expect(activeCell.value).toEqual({ rowIndex: 2, columnIndex: 3 });
  });

  it('setting null then null is a no-op', () => {
    const { activeCell, setActiveCell } = useActiveCell();
    setActiveCell(null);
    expect(activeCell.value).toBeNull();
    setActiveCell(null);
    expect(activeCell.value).toBeNull();
  });
});
