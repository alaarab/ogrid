import { LiveDemo } from '../LiveDemo';
import { people, getRowId, conditionFilterColumns } from './demoData';

export default function ConditionFilterDemo() {
  return (
    <LiveDemo height={420} title="Open the Age, Salary, Name or Start Date filter: try Top N, Between, or two conditions with Or">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={conditionFilterColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
            defaultSortBy="salary"
            defaultSortDirection="desc"
          />
        );
      }}
    </LiveDemo>
  );
}
