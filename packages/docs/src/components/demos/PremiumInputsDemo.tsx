import { LiveDemo } from '../LiveDemo';

interface TaskRow {
  id: number;
  task: string;
  due: string;
  rating: number;
  color: string;
  effort: number;
  tags: string;
}

const tasks: TaskRow[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  task: ['Design review', 'API integration', 'Bug triage', 'Docs pass', 'Release prep'][i % 5],
  due: `2026-0${(i % 6) + 1}-${String((i % 27) + 1).padStart(2, '0')}`,
  rating: (i % 5) + 1,
  color: ['#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#A66DD4'][i % 5],
  effort: 10 + (i % 9) * 10,
  tags: ['React, Docs', 'API', 'Bug, Urgent', 'Docs', 'Release'][i % 5],
}));

export default function PremiumInputsDemo() {
  return (
    <LiveDemo height={420} title="Double-click a cell — each column uses a different premium editor">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        const { DatePickerEditor, RatingEditor, ColorPickerEditor, SliderEditor, TagsEditor } =
          require('@alaarab/ogrid-react-inputs') as typeof import('@alaarab/ogrid-react-inputs');
        const columns = [
          { columnId: 'task', name: 'Task', defaultWidth: 150 },
          { columnId: 'due', name: 'Due (DatePicker)', editable: true, cellEditor: DatePickerEditor, cellEditorPopup: true, defaultWidth: 160 },
          { columnId: 'rating', name: 'Rating (Rating)', editable: true, cellEditor: RatingEditor, cellEditorPopup: true, cellEditorParams: { maxStars: 5 }, defaultWidth: 140 },
          { columnId: 'color', name: 'Color (ColorPicker)', editable: true, cellEditor: ColorPickerEditor, cellEditorPopup: true, defaultWidth: 160 },
          { columnId: 'effort', name: 'Effort % (Slider)', editable: true, cellEditor: SliderEditor, cellEditorPopup: true, cellEditorParams: { min: 0, max: 100, step: 5 }, defaultWidth: 150 },
          { columnId: 'tags', name: 'Tags (Tags)', editable: true, cellEditor: TagsEditor, cellEditorPopup: true, cellEditorParams: { suggestions: ['React', 'API', 'Bug', 'Docs', 'Urgent', 'Release'] }, defaultWidth: 170 },
        ];
        return <OGrid columns={columns} data={tasks} getRowId={(t: TaskRow) => t.id} editable defaultPageSize={10} />;
      }}
    </LiveDemo>
  );
}
