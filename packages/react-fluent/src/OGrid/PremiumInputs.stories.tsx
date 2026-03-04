import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { OGrid } from './OGrid';
import type { IColumnDef, ICellValueChangedEvent } from '@alaarab/ogrid-react';
import { RatingEditor, ColorPickerEditor, TagsEditor } from '@alaarab/ogrid-react-inputs';

interface ProductRow {
  id: string;
  name: string;
  rating: number;
  color: string;
  tags: string;
  price: number;
}

const TAG_SUGGESTIONS = ['Featured', 'Sale', 'New', 'Popular', 'Limited', 'Clearance', 'Exclusive'];

function makeProducts(count: number): ProductRow[] {
  const colors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];
  const names = ['Widget', 'Gadget', 'Doohickey', 'Thingamajig', 'Gizmo', 'Contraption'];
  return Array.from({ length: count }, (_, i) => ({
    id: `prod-${i + 1}`,
    name: `${names[i % names.length]} ${String.fromCharCode(65 + (i % 26))}`,
    rating: (i % 5) + 1,
    color: colors[i % colors.length],
    tags: TAG_SUGGESTIONS.slice(0, (i % 3) + 1).join(', '),
    price: Math.round((5 + Math.random() * 95) * 100) / 100,
  }));
}

const getRowId = (p: ProductRow) => p.id;

const meta: Meta<typeof OGrid<ProductRow>> = {
  title: 'OGrid/React Fluent/Premium Inputs',
  component: OGrid as React.ComponentType,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof OGrid<ProductRow>>;

export const PremiumEditors: Story = {
  render: function PremiumEditorsStory() {
    const [data, setData] = React.useState(() => makeProducts(10));
    const handleCellValueChanged = React.useCallback((e: ICellValueChangedEvent<ProductRow>) => {
      setData((prev) =>
        prev.map((row) =>
          row.id === e.item.id ? { ...row, [e.field]: e.newValue } : row
        )
      );
    }, []);

    const columns: IColumnDef<ProductRow>[] = [
      {
        columnId: 'name',
        name: 'Product',
        sortable: true,
        editable: true,
        cellEditor: 'text',
        minWidth: 140,
      },
      {
        columnId: 'rating',
        name: 'Rating',
        sortable: true,
        editable: true,
        cellEditor: RatingEditor,
        cellEditorPopup: true,
        cellEditorParams: { maxStars: 5 },
        renderCell: (item) => <span>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>,
        minWidth: 120,
      },
      {
        columnId: 'color',
        name: 'Color',
        sortable: true,
        editable: true,
        cellEditor: ColorPickerEditor,
        cellEditorPopup: true,
        renderCell: (item) => (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: item.color, display: 'inline-block' }} />
            {item.color}
          </span>
        ),
        minWidth: 120,
      },
      {
        columnId: 'tags',
        name: 'Tags',
        sortable: true,
        editable: true,
        cellEditor: TagsEditor,
        cellEditorPopup: true,
        cellEditorParams: { suggestions: TAG_SUGGESTIONS },
        minWidth: 180,
      },
      {
        columnId: 'price',
        name: 'Price',
        type: 'numeric',
        sortable: true,
        editable: true,
        cellEditor: 'text',
        valueFormatter: (v) => typeof v === 'number' ? `$${v.toFixed(2)}` : String(v ?? ''),
        minWidth: 90,
      },
    ];

    return (
      <OGrid<ProductRow>
        data={data}
        columns={columns}
        getRowId={getRowId}
        entityLabelPlural="products"
        editable
        onCellValueChanged={handleCellValueChanged}
        statusBar
        defaultPageSize={10}
      />
    );
  },
};
