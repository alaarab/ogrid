import React, { useMemo } from 'react';
import { OGrid } from '@alaarab/ogrid-react-radix';
import type { IDataSource, IFetchParams } from '@alaarab/ogrid-react-radix';
import { LiveDemo } from '../LiveDemo';
import { people, getRowId, sortingColumns, type Person } from './demoData';
import { serverSideData } from '../../stackblitz/featureDemos';

export default function ServerSideDemo() {
  const dataSource = useMemo<IDataSource<Person>>(() => ({
    async fetchPage({ page, pageSize, sort }: IFetchParams) {
      await new Promise(r => setTimeout(r, 300));
      let items = [...people];
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

  return (
    <LiveDemo height={420} title="Simulated 300ms server latency — watch the loading state" stackblitz={serverSideData}>
      <OGrid columns={sortingColumns} dataSource={dataSource} getRowId={getRowId}
        defaultPageSize={5} entityLabelPlural="people" />
    </LiveDemo>
  );
}
