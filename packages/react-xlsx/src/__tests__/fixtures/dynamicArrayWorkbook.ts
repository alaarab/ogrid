import ExcelJS from 'exceljs';
import JSZip from 'jszip';

/** Excel's dynamic-array OOXML: independent of ExcelJS's legacy array writer.
 * XLDAPR is the second metadata type/record to exercise index preservation. */
export async function dynamicArrayFixture(): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Arrays');
  ws.addRows([[3, 1], [null, 2], [null, 3]]);
  ws.getCell('B1').value = { formula: '_xlfn.SEQUENCE(A1)', shareType: 'array', ref: 'B1:B3', result: 1 };
  const zip = await JSZip.loadAsync(await wb.xlsx.writeBuffer());
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sheetMetadata';
  zip.file('xl/metadata.xml', `<metadata xmlns="${main}" xmlns:xda="http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray"><metadataTypes count="2"><metadataType name="OTHER" minSupportedVersion="120000" cellMeta="1"/><metadataType name="XLDAPR" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1" cellMeta="1"/></metadataTypes><futureMetadata name="OTHER" count="1"><bk/></futureMetadata><futureMetadata name="XLDAPR" count="1"><bk><extLst><ext uri="{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}"><xda:dynamicArrayProperties fDynamic="1" fCollapsed="0"/></ext></extLst></bk></futureMetadata><cellMetadata count="2"><bk><rc t="1" v="0"/></bk><bk><rc t="2" v="0"/></bk></cellMetadata></metadata>`);
  const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  zip.file('xl/worksheets/sheet1.xml', sheet.replace('<c r="B1"', '<c r="B1" cm="2"'));
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  zip.file('xl/_rels/workbook.xml.rels', rels.replace('</Relationships>', `<Relationship Id="rIdMetadata" Type="${rel}" Target="metadata.xml"/></Relationships>`));
  const types = await zip.file('[Content_Types].xml')!.async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', '<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/></Types>'));
  return new Blob([await zip.generateAsync({ type: 'uint8array' })]);
}
