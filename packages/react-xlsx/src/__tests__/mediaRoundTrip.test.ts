import { describe, expect, test } from 'bun:test';
import { posix } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { workbookFromBlob } from '../sheetMapper';
import { xlsxBlobFromWorkbook } from '../exportToXlsx';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { mediaWorkbookBlob, PNG } from './fixtures/mediaWorkbook';

// happy-dom's DOMParser does not implement XML namespaces. Parse actual XML
// with SAX, independently of the production tree/serializer and path helpers.
interface Node { name: string; textContent: string; attributes: Array<{ namespaceURI: string; value: string }>; getAttribute: (name: string) => string | null }
interface XmlDoc { documentElement: Node; all: Node[]; getElementsByTagName: (name: string) => Node[] }
function xml(s: string): XmlDoc {
  const parser = new SaxesParser({ xmlns: true });
  const all: Node[] = [];
  const stack: Node[] = [];
  parser.on('opentag', (tag) => {
    const node: Node = { name: tag.local, textContent: '', attributes: Object.values(tag.attributes).map((a) => ({ namespaceURI: a.uri, value: a.value })), getAttribute: (name) => tag.attributes[name]?.value ?? null };
    all.push(node); stack.push(node);
  });
  parser.on('text', (s) => { for (const n of stack) n.textContent += s; });
  parser.on('closetag', () => { stack.pop(); });
  parser.write(s).close();
  return { documentElement: all[0]!, all, getElementsByTagName: () => all };
}
const nodes = (doc: XmlDoc, name: string) => doc.all.filter((n) => n.name === name);
const resolve = (owner: string, target: string) => target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(posix.dirname(owner), target));
async function part(zip: JSZip, path: string) { return xml(await zip.file(path)!.async('string')); }

// Inspect the actual OPC contract independently of the production XML helpers.
async function assertValidPackage(zip: JSZip) {
  const types = await part(zip, '[Content_Types].xml');
  const overrides = nodes(types, 'Override');
  const defaults = nodes(types, 'Default');
  for (const override of overrides) expect(zip.file(override.getAttribute('PartName')!.slice(1))).not.toBeNull();
  for (const path of Object.keys(zip.files).filter((p) => p.endsWith('.rels'))) {
    const owner = path === '_rels/.rels' ? '' : path.replace('/_rels/', '/').replace(/\.rels$/, '');
    const doc = await part(zip, path);
    const relationships = nodes(doc, 'Relationship');
    const ids = relationships.map((r) => r.getAttribute('Id'));
    expect(new Set(ids).size).toBe(ids.length);
    for (const rel of relationships) {
      if (rel.getAttribute('TargetMode') === 'External') continue;
      const target = resolve(owner, rel.getAttribute('Target')!);
      expect(zip.file(target)).not.toBeNull();
      expect(overrides.some((o) => o.getAttribute('PartName') === '/' + target) || defaults.some((d) => d.getAttribute('Extension') === target.split('.').pop())).toBe(true);
    }
    if (zip.file(owner) && owner.endsWith('.xml')) {
      const body = await part(zip, owner);
      for (const el of Array.from(body.getElementsByTagName('*'))) {
        for (const attr of Array.from(el.attributes)) {
          if (attr.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships') expect(ids).toContain(attr.value);
        }
      }
    }
  }
}

describe('XLSX images, charts and pivots', () => {
  test('edit and export preserves mixed drawings, chart-only sheets, pivot caches, notes and hyperlinks', async () => {
    const wb = await workbookFromBlob(await mediaWorkbookBlob());
    const doc = new XlsxWorkbookDocument(wb);
    doc.setCellValues('Sales', [{ rowId: 0, columnId: 'B', value: 99 }]);
    const blob = await doc.toBlob();
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    await assertValidPackage(zip);
    const reread = new ExcelJS.Workbook();
    await reread.xlsx.load(await blob.arrayBuffer());
    const sheet = reread.getWorksheet('Sales')!;
    expect(sheet.getCell('B2').value).toBe(99);
    expect(sheet.getCell('A6').hyperlink).toBe('https://example.com/sales');
    expect(sheet.getCell('A6').note).toContain('Keep this note');
    expect(sheet.getImages()).toHaveLength(1);
    const image = sheet.getImages()[0]!;
    expect(Buffer.from(reread.getImage(Number(image.imageId)).buffer!).toString('base64')).toBe(PNG);
    expect(image.range.tl.col).toBeCloseTo(0.25, 3);
    expect(image.range.br.row).toBeCloseTo(3.5, 3);
    const charts = Object.keys(zip.files).filter((p) => /^xl\/charts\/[^/]+\.xml$/.test(p));
    expect(charts).toHaveLength(1); // Both sheets share one chart part.
    const chart = await part(zip, charts[0]!);
    expect(nodes(chart, 't')[0]!.textContent).toBe('Sales by Region');
    expect(nodes(chart, 'f').map((n) => n.textContent)).toEqual(['Sales!$A$2:$A$4', 'Sales!$B$2:$B$4']);
    let chartAnchors = 0;
    for (const path of Object.keys(zip.files).filter((p) => /^xl\/drawings\/[^/]+\.xml$/.test(p))) {
      const drawing = await part(zip, path);
      chartAnchors += nodes(drawing, 'chart').length;
      const ids = nodes(drawing, 'cNvPr').map((n) => n.getAttribute('id'));
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(chartAnchors).toBe(2);
    const pivot = await part(zip, 'xl/pivotTables/pivotTable1.xml');
    expect(pivot.documentElement.getAttribute('cacheId')).toBe('3');
    expect(nodes(pivot, 'location')[0]!.getAttribute('ref')).toBe('D8:E11');
    const cache = await part(zip, 'xl/pivotCache/pivotCacheDefinition1.xml');
    expect(cache.documentElement.getAttribute('refreshOnLoad')).toBe('1');
    expect(nodes(cache, 'worksheetSource')[0]!.getAttribute('ref')).toBe('A1:B4');
    expect(nodes(await part(zip, 'xl/workbook.xml'), 'pivotCache')[0]!.getAttribute('cacheId')).toBe('3');
    expect(nodes(await part(zip, 'xl/pivotCache/pivotCacheRecords1.xml'), 'r')).toHaveLength(3);
    expect(nodes(await part(zip, 'xl/worksheets/_rels/sheet1.xml.rels'), 'Relationship').some((r) => r.getAttribute('Type')?.endsWith('/pivotTable'))).toBe(true);
  });

  test('the workbook serializer preserves media metadata from toWorkbook and a second import/export', async () => {
    const wb = await workbookFromBlob(await mediaWorkbookBlob());
    // A new image must coexist with original chart anchors in the drawing.
    wb.getWorksheet('Charts')!.addImage(wb.addImage({ base64: PNG, extension: 'png' }), { tl: { col: 3, row: 1 }, ext: { width: 30, height: 40 } });
    const doc = new XlsxWorkbookDocument(wb);
    const once = await xlsxBlobFromWorkbook(await doc.toWorkbook());
    const reopened = await workbookFromBlob(once);
    const second = await new XlsxWorkbookDocument(reopened).toBlob();
    const zip = await JSZip.loadAsync(await second.arrayBuffer());
    await assertValidPackage(zip);
    expect(reopened.getWorksheet('Charts')!.getImages()).toHaveLength(1);
    expect(Object.keys(zip.files).filter((p) => /^xl\/charts\/[^/]+\.xml$/.test(p))).toHaveLength(1);
    expect(Object.keys(zip.files).filter((p) => /^xl\/pivotTables\/[^/]+\.xml$/.test(p))).toHaveLength(1);
  });
});
