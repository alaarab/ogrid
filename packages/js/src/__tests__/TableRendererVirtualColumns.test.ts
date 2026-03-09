import { GridState } from '../state/GridState';
import { TableRenderer } from '../renderer/TableRenderer';

type Row = {
  id: string;
  col0: string;
  col1: string;
  col2: string;
  col3: string;
};

describe('TableRenderer column virtualization', () => {
  it('uses visible column indexes for selection and fill-handle state when rendering a virtualized subset', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const state = new GridState<Row>({
      columns: [
        { columnId: 'col0', name: 'Col 0' },
        { columnId: 'col1', name: 'Col 1' },
        { columnId: 'col2', name: 'Col 2' },
        { columnId: 'col3', name: 'Col 3' },
      ],
      data: [
        { id: 'r1', col0: 'A', col1: 'B', col2: 'C', col3: 'D' },
      ],
      getRowId: (item) => item.id,
      cellSelection: true,
    });

    const renderer = new TableRenderer<Row>(container, state);
    renderer.setVirtualScrollState({
      enabled: false,
      columnVirtualizationEnabled: true,
      columnRange: { startIndex: 2, endIndex: 2 },
    } as never);
    renderer.setInteractionState({
      activeCell: null,
      selectionRange: { startRow: 0, startCol: 2, endRow: 0, endCol: 2 },
      copyRange: null,
      cutRange: null,
      editingCell: null,
      columnWidths: {},
      onFillHandleMouseDown: jest.fn(),
    });

    renderer.render();

    expect(container.querySelector('td[data-row-index="0"][data-col-index="2"]')?.getAttribute('data-in-range')).toBe('true');
    expect(container.querySelector('td[data-row-index="0"][data-col-index="0"]')).toBeNull();

    const fillHandleParent = container.querySelector('.ogrid-fill-handle')?.parentElement;
    expect(fillHandleParent?.getAttribute('data-col-index')).toBe('2');

    renderer.destroy();
    state.destroy();
  });
});
