# @alaarab/ogrid-react-inputs

Opt-in premium cell editors for OGrid: date, time and date-time pickers, star rating, color picker, slider, and tags. Nothing is added to your bundle unless you import it.

## Install

```bash
npm install @alaarab/ogrid-react-inputs
```

## Usage

Set an editor as a column's `cellEditor` and open it in a popup:

```tsx
import { DatePickerEditor, RatingEditor } from '@alaarab/ogrid-react-inputs';

const columns = [
  { columnId: 'dueDate', name: 'Due', editable: true, cellEditor: DatePickerEditor, cellEditorPopup: true },
  { columnId: 'score', name: 'Score', editable: true, cellEditor: RatingEditor, cellEditorPopup: true },
];
```

Editors: `DatePickerEditor`, `TimePickerEditor`, `DateTimePickerEditor`, `RatingEditor`, `ColorPickerEditor`, `SliderEditor`, `TagsEditor`. They work with both `@alaarab/ogrid-react-radix` and `@alaarab/ogrid-react-fluent`. React 17, 18 and 19 are supported.

See the [premium inputs docs](https://alaarab.github.io/ogrid/docs/features/premium-inputs) for each editor's options.
