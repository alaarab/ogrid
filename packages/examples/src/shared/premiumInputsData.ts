export interface PremiumInputRow {
  id: string;
  name: string;
  dueDate: string;
  rating: number;
  color: string;
  progress: number;
  tags: string;
  price: number;
}

export interface PremiumInputEditors {
  dateEditor: unknown;
  ratingEditor: unknown;
  colorEditor: unknown;
  sliderEditor: unknown;
  tagsEditor: unknown;
}

export interface PremiumInputColumn {
  columnId: string;
  name: string;
  type?: 'date' | 'numeric';
  sortable?: boolean;
  editable?: boolean;
  cellEditor?: unknown;
  cellEditorPopup?: boolean;
  cellEditorParams?: Record<string, unknown>;
  minWidth?: number;
  valueFormatter?: (value: unknown) => string;
}

export const PREMIUM_TAG_SUGGESTIONS = [
  'Featured',
  'Sale',
  'New',
  'Popular',
  'Limited',
  'Clearance',
  'Exclusive',
] as const;

const PREMIUM_COLORS = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'] as const;
const PREMIUM_NAMES = ['Widget', 'Gadget', 'Doohickey', 'Thingamajig', 'Gizmo', 'Contraption'] as const;

export function makePremiumInputRows(count: number = 10): PremiumInputRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `prod-${index + 1}`,
    name: `${PREMIUM_NAMES[index % PREMIUM_NAMES.length]} ${String.fromCharCode(65 + (index % 26))}`,
    dueDate: `2024-${String((index % 9) + 1).padStart(2, '0')}-15`,
    rating: (index % 5) + 1,
    color: PREMIUM_COLORS[index % PREMIUM_COLORS.length],
    progress: 20 + ((index * 13) % 70),
    tags: PREMIUM_TAG_SUGGESTIONS.slice(0, (index % 3) + 1).join(', '),
    price: Math.round((15 + index * 4.75) * 100) / 100,
  }));
}

export function makePremiumInputColumns(editors: PremiumInputEditors): PremiumInputColumn[] {
  return [
    {
      columnId: 'name',
      name: 'Product',
      sortable: true,
      editable: true,
      cellEditor: 'text',
      minWidth: 140,
    },
    {
      columnId: 'dueDate',
      name: 'Due Date',
      type: 'date',
      sortable: true,
      editable: true,
      cellEditor: editors.dateEditor,
      cellEditorPopup: true,
      minWidth: 140,
    },
    {
      columnId: 'rating',
      name: 'Rating',
      type: 'numeric',
      sortable: true,
      editable: true,
      cellEditor: editors.ratingEditor,
      cellEditorPopup: true,
      cellEditorParams: { maxStars: 5 },
      minWidth: 120,
    },
    {
      columnId: 'color',
      name: 'Color',
      sortable: true,
      editable: true,
      cellEditor: editors.colorEditor,
      cellEditorPopup: true,
      minWidth: 120,
    },
    {
      columnId: 'progress',
      name: 'Progress',
      type: 'numeric',
      sortable: true,
      editable: true,
      cellEditor: editors.sliderEditor,
      cellEditorPopup: true,
      cellEditorParams: { min: 0, max: 100, step: 5 },
      minWidth: 130,
    },
    {
      columnId: 'tags',
      name: 'Tags',
      sortable: true,
      editable: true,
      cellEditor: editors.tagsEditor,
      cellEditorPopup: true,
      cellEditorParams: { suggestions: PREMIUM_TAG_SUGGESTIONS },
      minWidth: 180,
    },
    {
      columnId: 'price',
      name: 'Price',
      type: 'numeric',
      sortable: true,
      editable: true,
      cellEditor: 'text',
      minWidth: 90,
      valueFormatter: (value: unknown) => typeof value === 'number' ? `$${value.toFixed(2)}` : String(value ?? ''),
    },
  ];
}

export const getPremiumInputRowId = (row: PremiumInputRow) => row.id;
