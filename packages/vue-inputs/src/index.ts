/**
 * @alaarab/ogrid-vue-inputs  -  Premium cell editors for OGrid (Vue).
 *
 * This package provides optional, opt-in cell editor components.
 * Zero bundle impact when not installed.
 *
 * Available editors:
 * - DatePickerEditor   -  Calendar-based date picker (use with cellEditorPopup: true)
 * - RatingEditor       -  Star rating 1–N (use with cellEditorPopup: true)
 * - ColorPickerEditor  -  Color swatch grid with hex input (use with cellEditorPopup: true)
 * - SliderEditor       -  Range slider with drag support (use with cellEditorPopup: true)
 * - TagsEditor         -  Multi-value tag/chip editor (use with cellEditorPopup: true)
 *
 * Usage:
 *   import { DatePickerEditor } from '@alaarab/ogrid-vue-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditor,
 *     cellEditorPopup: true,
 *   }];
 */

// DatePicker
export { DatePickerEditor } from './DatePicker';

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
