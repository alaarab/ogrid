import type { Meta, StoryObj } from '@storybook/vue3-vite';
import { OGrid } from './OGrid';
import type { IOGridProps, IColumnDef } from '@alaarab/ogrid-vue';
import { RatingEditor, ColorPickerEditor, TagsEditor } from '@alaarab/ogrid-vue-inputs';

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

const premiumColumns: IColumnDef<ProductRow>[] = [
  { columnId: 'name', name: 'Product', sortable: true, editable: true, cellEditor: 'text', minWidth: 140 },
  { columnId: 'rating', name: 'Rating', sortable: true, editable: true, cellEditor: RatingEditor, cellEditorPopup: true, cellEditorParams: { maxStars: 5 }, minWidth: 120 },
  { columnId: 'color', name: 'Color', sortable: true, editable: true, cellEditor: ColorPickerEditor, cellEditorPopup: true, minWidth: 120 },
  { columnId: 'tags', name: 'Tags', sortable: true, editable: true, cellEditor: TagsEditor, cellEditorPopup: true, cellEditorParams: { suggestions: TAG_SUGGESTIONS }, minWidth: 180 },
  {
    columnId: 'price',
    name: 'Price',
    type: 'numeric',
    sortable: true,
    editable: true,
    cellEditor: 'text',
    valueFormatter: (v: unknown) => typeof v === 'number' ? `$${(v as number).toFixed(2)}` : String(v ?? ''),
    minWidth: 90,
  },
];

function makeGridProps(overrides: Partial<IOGridProps<ProductRow>> = {}): IOGridProps<ProductRow> {
  return {
    data: makeProducts(10),
    columns: premiumColumns,
    getRowId,
    entityLabelPlural: 'products',
    editable: true,
    statusBar: true,
    defaultPageSize: 10,
    ...overrides,
  };
}

const meta: Meta<typeof OGrid> = {
  title: 'OGrid/Vue PrimeVue/Premium Inputs',
  component: OGrid,
  parameters: { layout: 'padded' },
};

export default meta;

type Story = StoryObj<typeof OGrid>;

export const PremiumEditors: Story = {
  render: () => ({
    components: { OGrid },
    setup() {
      return { gridProps: makeGridProps() };
    },
    template: '<OGrid :grid-props="gridProps" />',
  }),
};
