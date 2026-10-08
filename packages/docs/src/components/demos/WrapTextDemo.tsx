import { LiveDemo } from '../LiveDemo';

interface Ticket {
  id: number;
  title: string;
  notes: string;
  owner: string;
}

const tickets: Ticket[] = [
  { id: 1, title: 'Login fails on Safari', notes: 'Steps:\n1. Open the login page\n2. Sign in with SSO\nThe redirect loops back to the login page.', owner: 'Ana' },
  { id: 2, title: 'Export button', notes: 'Rename to "Download".', owner: 'Ben' },
  { id: 3, title: 'Slow dashboard', notes: 'The revenue widget runs one query per region on every render; batching them should bring the first paint under a second.', owner: 'Chen' },
  { id: 4, title: 'Typo in footer', notes: 'Fixed.', owner: 'Dee' },
];

export default function WrapTextDemo() {
  return (
    <LiveDemo height={420} title="Notes wraps and rows grow to fit. Double-click a note and press Alt+Enter (Option+Enter) for a new line; drag a row number's bottom edge to set a manual height">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return (
          <OGrid
            columns={[
              { columnId: 'title', name: 'Title', defaultWidth: 170, editable: true },
              { columnId: 'notes', name: 'Notes', defaultWidth: 320, editable: true, wrapText: true },
              { columnId: 'owner', name: 'Owner', defaultWidth: 90, editable: true },
            ]}
            data={tickets}
            getRowId={(t: Ticket) => t.id}
            editable
            showRowNumbers
            rowResize
          />
        );
      }}
    </LiveDemo>
  );
}
