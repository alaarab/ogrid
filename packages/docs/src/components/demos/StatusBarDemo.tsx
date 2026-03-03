import React from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, statusBarColumns } from './demoData';

export default function StatusBarDemo() {
  return (
    <LiveDemo height={420} title="Select numeric cells (Age, Salary) to see aggregations in the status bar">
      {() => {
        const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
        return <OGrid columns={statusBarColumns} data={people} getRowId={getRowId}
          statusBar cellSelection defaultPageSize={10} />;
      }}
    </LiveDemo>
  );
}
