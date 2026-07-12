import { LiveDemo } from '../LiveDemo';

interface ProductRow {
  id: number;
  product: string;
  price: number;
  released: string;
  inStock: boolean;
}

const products: ProductRow[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  product: ['Keyboard', 'Monitor', 'Dock', 'Webcam', 'Headset', 'Mouse'][i % 6],
  price: 19 + (i % 12) * 25,
  released: `202${3 + (i % 3)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
  inStock: i % 3 !== 0,
}));

export default function ColumnTypesDemo() {
  return (
    <LiveDemo height={420} title="Each column type gets matching alignment, formatting, editor, and filter">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        const columns = [
          { columnId: 'product', name: 'Product (text)', sortable: true },
          { columnId: 'price', name: 'Price (numeric)', type: 'numeric' as const, sortable: true, editable: true, valueFormatter: (v: unknown) => (v != null ? `$${Number(v).toLocaleString()}` : '') },
          { columnId: 'released', name: 'Released (date)', type: 'date' as const, sortable: true, editable: true },
          { columnId: 'inStock', name: 'In stock (boolean)', type: 'boolean' as const, editable: true, sortable: true },
        ];
        return <OGrid columns={columns} data={products} getRowId={(p: ProductRow) => p.id} editable defaultPageSize={10} />;
      }}
    </LiveDemo>
  );
}
