import React from 'react';
import { LiveDemo } from '../LiveDemo';

export default function XlsxStreamingDemo() {
  return <LiveDemo height={520} title="Stream an XLSX file, cancel, then enable editing">
    {() => {
      const { XlsxWorkbookGrid } = require('@alaarab/ogrid-react-xlsx') as typeof import('@alaarab/ogrid-react-xlsx');
      function UploadDemo() {
        const [file, setFile] = React.useState<File | null>(null);
        return <>
          <label style={{ display: 'block', padding: 8 }}>Choose an XLSX file: <input type="file" accept=".xlsx" onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} /></label>
          {file ? <XlsxWorkbookGrid key={file.name + file.lastModified} blob={file} streaming editable height={430} exportFileName={file.name} /> : <p style={{ padding: 8 }}>Rows appear as the file loads. Enable editing after loading to show workbook formatting and change cells.</p>}
        </>;
      }
      return <UploadDemo />;
    }}
  </LiveDemo>;
}
