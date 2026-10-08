import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import { LiveDemo } from '../LiveDemo';

export default function XlsxMediaDemo() {
  const fixtureUrl = useBaseUrl('/examples/xlsx-media.xlsx');
  return (
    <LiveDemo height={430} title="Images, chart placeholders and a pivot: edit Sales, export, then open in Excel">
      {() => {
        const { XlsxWorkbookGrid } = require('@alaarab/ogrid-react-xlsx') as typeof import('@alaarab/ogrid-react-xlsx');
        function MediaDemo() {
          const [blob, setBlob] = React.useState<Blob | null>(null);
          const [error, setError] = React.useState<string | null>(null);
          React.useEffect(() => {
            const controller = new AbortController();
            fetch(fixtureUrl, { signal: controller.signal })
              .then((response) => { if (!response.ok) throw new Error('Could not load workbook'); return response.blob(); })
              .then(setBlob)
              .catch((e: Error) => { if (!controller.signal.aborted) setError(e.message); });
            return () => controller.abort();
          }, []);
          if (error) return <div role="alert">{error}</div>;
          if (!blob) return <div>Loading workbook…</div>;
          return <XlsxWorkbookGrid blob={blob} height={410} editable exportFileName="xlsx-media.xlsx" />;
        }
        return <MediaDemo />;
      }}
    </LiveDemo>
  );
}
