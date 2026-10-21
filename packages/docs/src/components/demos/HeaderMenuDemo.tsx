import { LiveDemo } from '../LiveDemo';
import { people, getRowId, paginationColumns } from './demoData';

export default function HeaderMenuDemo() {
  return (
    <LiveDemo height={420} title="Open the settings button in the header's top-right corner">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={paginationColumns}
            data={people}
            getRowId={getRowId}
            defaultPageSize={10}
            headerMenu
            headerMenuItems={[
              {
                id: 'export',
                label: 'Export',
                items: [
                  { id: 'exportCsv', label: 'CSV', onClick: () => window.alert('Export CSV') },
                  { id: 'exportJson', label: 'JSON', onClick: () => window.alert('Export JSON') },
                ],
              },
              { id: 'help', label: 'Help', onClick: () => window.alert('Help') },
            ]}
          />
        );
      }}
    </LiveDemo>
  );
}
