/**
 * @alaarab/ogrid-react-inputs  -  Premium cell editors for OGrid.
 *
 * This package provides optional, opt-in cell editor components.
 * Zero bundle impact when not installed.
 *
 * Available editors:
 * - DatePickerEditor  -  Calendar-based date picker (use with cellEditorPopup: true)
 * - RatingEditor  -  Star rating editor (use with cellEditorPopup: true)
 * - ColorPickerEditor  -  Color swatch grid + hex input (use with cellEditorPopup: true)
 * - SliderEditor  -  Range slider for numeric values (use with cellEditorPopup: true)
 * - TagsEditor  -  Multi-value tag/chip editor (use with cellEditorPopup: true)
 *
 * Usage:
 *   import { DatePickerEditor } from '@alaarab/ogrid-react-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 */

// DatePicker
export { DatePickerEditor } from './DatePicker';
export type { CalendarDay } from './DatePicker';

// Rating
export { RatingEditor } from './Rating';

// ColorPicker
export { ColorPickerEditor } from './ColorPicker';

// Slider
export { SliderEditor } from './Slider';

// Tags
export { TagsEditor } from './Tags';

// Re-export core types consumers commonly need alongside editors
export type { ICellEditorProps, CellEditorParams } from '@alaarab/ogrid-core';
