import React, { useMemo } from 'react';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns, type Person } from './demoData';

function Inner() {
  const { OGrid } = require('@alaarab/ogrid-react-radix') as typeof import('@alaarab/ogrid-react-radix');
  type IDataSource = import('@alaarab/ogrid-react-radix').IDataSource<Person>;
  type IFetchParams = import('@alaarab/ogrid-react-radix').IFetchParams;

  const dataSource = useMemo<IDataSource>(() => ({
    async fetchPage({ page, pageSize, sort }: IFetchParams) {
      await new Promise(r => setTimeout(r, 300));
      const items = [...people];
      if (sort) {
        items.sort((a, b) => {
          const av = (a as Record<string, unknown>)[sort.field];
          const bv = (b as Record<string, unknown>)[sort.field];
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          return sort.direction === 'asc' ? cmp : -cmp;
        });
      }
      const start = (page - 1) * pageSize;
      return { items: items.slice(start, start + pageSize), totalCount: items.length };
    },
  }), []);

  return <OGrid columns={sortingColumns} dataSource={dataSource} getRowId={getRowId}
    defaultPageSize={5} entityLabelPlural="people" />;
}

export default function ServerSideDemo() {
  return (
    <LiveDemo height={420} title="Simulated 300ms server latency  -  watch the loading state">
      {() => <Inner />}
    </LiveDemo>
  );
}
