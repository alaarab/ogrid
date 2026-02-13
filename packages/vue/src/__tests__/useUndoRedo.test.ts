import { useUndoRedo } from '../composables/useUndoRedo';
import type { ICellValueChangedEvent } from '../types';

type Row = { id: string; name: string; value: number };

function makeEvent(overrides: Partial<ICellValueChangedEvent<Row>> = {}): ICellValueChangedEvent<Row> {
  return {
    item: { id: '1', name: 'Alpha', value: 100 },
    columnId: 'name',
    oldValue: 'Alpha',
    newValue: 'Beta',
    rowIndex: 0,
    ...overrides,
  };
}

describe('useUndoRedo', () => {
  it('initializes canUndo and canRedo as false', () => {
    const { canUndo, canRedo } = useUndoRedo<Row>({ onCellValueChanged: jest.fn() });
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(false);
  });

  it('wraps onCellValueChanged and enables undo', () => {
    const original = jest.fn();
    const { onCellValueChanged, canUndo } = useUndoRedo<Row>({ onCellValueChanged: original });

    const event = makeEvent();
    onCellValueChanged!(event);

    expect(original).toHaveBeenCalledWith(event);
    expect(canUndo.value).toBe(true);
  });

  it('returns undefined onCellValueChanged when original is undefined', () => {
    const { onCellValueChanged } = useUndoRedo<Row>({ onCellValueChanged: undefined });
    expect(onCellValueChanged).toBeUndefined();
  });

  it('undo reverses the last change', () => {
    const original = jest.fn();
    const { onCellValueChanged, undo, canUndo, canRedo } = useUndoRedo<Row>({
      onCellValueChanged: original,
    });

    onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'B' }));
    expect(canUndo.value).toBe(true);

    undo();
    // Should call original with reversed values
    expect(original).toHaveBeenLastCalledWith(
      expect.objectContaining({ oldValue: 'B', newValue: 'A' })
    );
    expect(canUndo.value).toBe(false);
    expect(canRedo.value).toBe(true);
  });

  it('redo re-applies the undone change', () => {
    const original = jest.fn();
    const { onCellValueChanged, undo, redo, canRedo } = useUndoRedo<Row>({
      onCellValueChanged: original,
    });

    const event = makeEvent({ oldValue: 'A', newValue: 'B' });
    onCellValueChanged!(event);
    undo();
    expect(canRedo.value).toBe(true);

    redo();
    expect(original).toHaveBeenLastCalledWith(event);
    expect(canRedo.value).toBe(false);
  });

  it('new edit clears redo stack', () => {
    const original = jest.fn();
    const { onCellValueChanged, undo, redo, canRedo } = useUndoRedo<Row>({
      onCellValueChanged: original,
    });

    onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'B' }));
    undo();
    expect(canRedo.value).toBe(true);

    // New edit should clear redo stack
    onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'C' }));
    expect(canRedo.value).toBe(false);
  });

  it('multiple undos work sequentially', () => {
    const original = jest.fn();
    const { onCellValueChanged, undo, canUndo } = useUndoRedo<Row>({
      onCellValueChanged: original,
    });

    onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'B' }));
    onCellValueChanged!(makeEvent({ oldValue: 'B', newValue: 'C' }));
    expect(canUndo.value).toBe(true);

    undo(); // undo C -> B
    expect(canUndo.value).toBe(true);

    undo(); // undo B -> A
    expect(canUndo.value).toBe(false);
  });

  it('undo does nothing when stack is empty', () => {
    const original = jest.fn();
    const { undo } = useUndoRedo<Row>({ onCellValueChanged: original });

    undo();
    // original should not be called for undo when nothing to undo
    expect(original).not.toHaveBeenCalled();
  });

  it('redo does nothing when stack is empty', () => {
    const original = jest.fn();
    const { redo } = useUndoRedo<Row>({ onCellValueChanged: original });

    redo();
    expect(original).not.toHaveBeenCalled();
  });

  describe('batch operations', () => {
    it('batches multiple changes into one undo step', () => {
      const original = jest.fn();
      const { onCellValueChanged, beginBatch, endBatch, undo, canUndo } = useUndoRedo<Row>({
        onCellValueChanged: original,
      });

      beginBatch();
      onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'B' }));
      onCellValueChanged!(makeEvent({ oldValue: 'X', newValue: 'Y', columnId: 'value' }));
      endBatch();

      expect(canUndo.value).toBe(true);

      // One undo should reverse both changes
      undo();
      expect(canUndo.value).toBe(false);
      // Should have called original twice more (for the two reversals)
      // original calls: 2 (initial) + 2 (undo) = 4
      expect(original).toHaveBeenCalledTimes(4);
    });

    it('empty batch does not add to history', () => {
      const { beginBatch, endBatch, canUndo } = useUndoRedo<Row>({
        onCellValueChanged: jest.fn(),
      });

      beginBatch();
      endBatch();
      expect(canUndo.value).toBe(false);
    });
  });

  it('respects maxUndoDepth', () => {
    const original = jest.fn();
    const { onCellValueChanged, canUndo, undo } = useUndoRedo<Row>({
      onCellValueChanged: original,
      maxUndoDepth: 2,
    });

    onCellValueChanged!(makeEvent({ oldValue: 'A', newValue: 'B' }));
    onCellValueChanged!(makeEvent({ oldValue: 'B', newValue: 'C' }));
    onCellValueChanged!(makeEvent({ oldValue: 'C', newValue: 'D' }));

    // Only 2 undos should be possible due to maxUndoDepth=2
    undo();
    expect(canUndo.value).toBe(true);
    undo();
    expect(canUndo.value).toBe(false);
  });

  it('exposes maxUndoDepth', () => {
    const { maxUndoDepth } = useUndoRedo<Row>({
      onCellValueChanged: jest.fn(),
      maxUndoDepth: 50,
    });
    expect(maxUndoDepth).toBe(50);
  });

  it('defaults maxUndoDepth to 100', () => {
    const { maxUndoDepth } = useUndoRedo<Row>({
      onCellValueChanged: jest.fn(),
    });
    expect(maxUndoDepth).toBe(100);
  });
});
