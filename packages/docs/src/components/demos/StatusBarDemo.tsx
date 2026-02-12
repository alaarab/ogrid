import React from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, statusBarColumns } from './demoData';
import { statusBar } from '../../stackblitz/featureDemos';

export default function StatusBarDemo() {
  return (
    <LiveDemo height={420} title="Select numeric cells (Age, Salary) to see aggregations in the status bar" stackblitz={statusBar}>
      <OGrid columns={statusBarColumns} data={people} getRowId={getRowId}
        statusBar cellSelection defaultPageSize={10} />
    </LiveDemo>
  );
}
