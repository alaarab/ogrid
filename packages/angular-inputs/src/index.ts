/**
 * @alaarab/ogrid-angular-inputs — Premium cell editors for OGrid (Angular).
 *
 * This package provides optional, opt-in cell editor components.
 * Zero bundle impact when not installed.
 *
 * Available editors:
 * - DatePickerEditorComponent  — Calendar-based date picker (use with cellEditorPopup: true)
 * - RatingEditorComponent      — Star rating editor (use with cellEditorPopup: true)
 * - ColorPickerEditorComponent — Color swatch grid editor (use with cellEditorPopup: true)
 * - SliderEditorComponent      — Range slider editor (use with cellEditorPopup: true)
 * - TagsEditorComponent        — Multi-value tag/chip editor (use with cellEditorPopup: true)
 *
 * Usage:
 *   import { DatePickerEditorComponent } from '@alaarab/ogrid-angular-inputs';
 *
 *   const columns = [{
 *     columnId: 'dueDate',
 *     cellEditor: DatePickerEditorComponent,
 *     cellEditorPopup: true,
 *   }];
 */

// DatePicker
export { DatePickerEditorComponent } from './DatePicker';

// Rating
export { RatingEditorComponent } from './Rating';

// ColorPicker
export { ColorPickerEditorComponent } from './ColorPicker';

// Slider
export { SliderEditorComponent } from './Slider';

// Tags
export { TagsEditorComponent } from './Tags';

// Re-export core types consumers commonly need alongside editors
export type { ICellEditorProps, CellEditorParams } from '@alaarab/ogrid-core';
