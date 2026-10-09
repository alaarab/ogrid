# @alaarab/ogrid-react-inputs

Optional MIT cell editors: date, time and date-time pickers, star rating, color picker, slider and tags. Supports React and ReactDOM 17, 18 and 19 with either OGrid kit. Depends on `ogrid-core` and the framework-free `ogrid-inputs` helpers.

```bash
npm install @alaarab/ogrid-react-inputs react react-dom
```

Set an editor on an editable column and open it in a popup:

```tsx
import type { IColumnDef } from '@alaarab/ogrid-react-radix';
import { DatePickerEditor, RatingEditor } from '@alaarab/ogrid-react-inputs';

interface Task { id: string; dueDate: string; score: number }
export const columns: IColumnDef<Task>[] = [
  { columnId: 'dueDate', name: 'Due', editable: true,
    cellEditor: DatePickerEditor, cellEditorPopup: true },
  { columnId: 'score', name: 'Score', editable: true,
    cellEditor: RatingEditor, cellEditorPopup: true },
];
```

Pass these columns to your kit's `<OGrid>` with `editable` and an `onCellValueChanged` handler. Other exports: `TimePickerEditor`, `DateTimePickerEditor`, `ColorPickerEditor`, `SliderEditor`, `TagsEditor`.

Editors are tree-shakeable and separate from the grid packages. See [editor options](https://alaarab.github.io/ogrid/docs/features/premium-inputs). Version 2.19.0.
