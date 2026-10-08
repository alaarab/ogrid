import { describe, expect, test } from 'bun:test';
import { posix } from 'node:path';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { SaxesParser } from 'saxes';
import { workbookFromBlob } from '../sheetMapper';
import { xlsxBlobFromWorkbook } from '../exportToXlsx';
import { XlsxWorkbookDocument } from '../xlsxDocument';
import { mediaWorkbookBlob, PNG } from './fixtures/mediaWorkbook';

// happy-dom's DOMParser does not implement XML namespaces. Parse actual XML
// with SAX, independently of the production tree/serializer and path helpers.
interface Node { name: string; textContent: string; children: Node[]; attributes: Array<{ namespaceURI: string; value: string }>; getAttribute: (name: string) => string | null }
interface XmlDoc { documentElement: Node; all: Node[]; getElementsByTagName: (name: string) => Node[] }
function xml(s: string): XmlDoc {
  const parser = new SaxesParser({ xmlns: true });
  const all: Node[] = [];
  const stack: Node[] = [];
  parser.on('opentag', (tag) => {
    const node: Node = { name: tag.local, textContent: '', children: [], attributes: Object.values(tag.attributes).map((a) => ({ namespaceURI: a.uri, value: a.value })), getAttribute: (name) => tag.attributes[name]?.value ?? null };
    stack[stack.length - 1]?.children.push(node);
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
  const styles = await part(zip, 'xl/styles.xml');
  const formatIds = new Set(nodes(styles, 'numFmts').flatMap((n) => n.children.map((f) => f.getAttribute('numFmtId'))));
  const dxfCount = nodes(styles, 'dxfs')[0]?.children.length ?? 0;
  for (const path of Object.keys(zip.files).filter((p) => /^xl\/(pivotTables|pivotCache)\/[^/]+\.xml$/.test(p))) {
    const pivot = await part(zip, path);
    for (const node of pivot.all) {
      const format = node.getAttribute('numFmtId');
      if (format && Number(format) >= 164) expect(formatIds.has(format)).toBe(true);
      const dxf = node.getAttribute('dxfId');
      if (dxf !== null) expect(Number(dxf)).toBeLessThan(dxfCount);
    }
    for (const source of nodes(pivot, 'cacheSource').filter((n) => n.getAttribute('type') === 'external')) {
      const rel = nodes(await part(zip, 'xl/_rels/workbook.xml.rels'), 'Relationship').find((n) => n.getAttribute('Type')?.endsWith('/connections'));
      expect(rel).toBeDefined();
      const connections = await part(zip, resolve('xl/workbook.xml', rel!.getAttribute('Target')!));
      expect(nodes(connections, 'connection').some((n) => n.getAttribute('id') === source.getAttribute('connectionId'))).toBe(true);
    }
  }
}

describe('XLSX images, charts and pivots', () => {
  async function roundTrips(blob: Blob, inspect: (zip: JSZip, workbook: ExcelJS.Workbook) => Promise<void>) {
    const directory = await mkdtemp(join(tmpdir(), 'ogrid-media-'));
    try {
      for (let i = 0; i < 2; i++) {
        const workbook = await workbookFromBlob(blob);
        const document = new XlsxWorkbookDocument(workbook);
        document.setCellValues('Sales', [{ rowId: 0, columnId: 'B', value: 99 + i }]);
        // Competing formats/dxfs force remapping rather than copying old IDs.
        for (let row = 2; row <= 8; row++) workbook.getWorksheet('Sales')!.getCell(`C${row}`).numFmt = '0.' + '0'.repeat(row + 3);
        workbook.getWorksheet('Sales')!.addConditionalFormatting({ ref: 'B2:B4', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: [15], priority: 1, style: { font: { bold: true } } }] });
        workbook.getWorksheet('Sales')!.addConditionalFormatting({ ref: 'B2:B4', rules: [{ type: 'cellIs', operator: 'lessThan', formulae: [15], priority: 2, style: { font: { italic: true } } }] });
        const file = join(directory, `export-${i}.xlsx`);
        await writeFile(file, new Uint8Array(await (await document.toBlob()).arrayBuffer()));
        blob = new Blob([new Uint8Array(await readFile(file))]);
        const reopened = await workbookFromBlob(blob);
        expect(reopened.getWorksheet('Sales')!.getCell('B2').value).toBe(99 + i);
        const zip = await JSZip.loadAsync(await blob.arrayBuffer());
        await inspect(zip, reopened);
        await assertValidPackage(zip);
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  }

  test('external pivot refresh connections and their dependency graph survive saved-file round trips', async () => {
    await roundTrips(await mediaWorkbookBlob({ externalConnection: true }), async (zip) => {
      const cache = await part(zip, 'xl/pivotCache/pivotCacheDefinition1.xml');
      expect(cache.documentElement.getAttribute('refreshOnLoad')).toBe('1');
      const source = nodes(cache, 'cacheSource')[0]!;
      const relationship = nodes(await part(zip, 'xl/_rels/workbook.xml.rels'), 'Relationship').find((r) => r.getAttribute('Type')?.endsWith('/connections'));
      expect(relationship).toBeDefined();
      const path = resolve('xl/workbook.xml', relationship!.getAttribute('Target')!);
      const connections = await part(zip, path);
      expect(nodes(connections, 'connection').find((n) => n.getAttribute('id') === source.getAttribute('connectionId'))?.getAttribute('name')).toBe('Sales DB');
      expect(nodes(connections, 'dbPr')[0]!.getAttribute('command')).toBe('SELECT Region, Sales FROM Sales');
      const rels = await part(zip, posix.join(posix.dirname(path), '_rels', posix.basename(path) + '.rels'));
      const dependency = nodes(rels, 'Relationship').find((r) => r.getAttribute('Id') === 'rIdSource')!;
      expect((await part(zip, resolve(path, dependency.getAttribute('Target')!))).documentElement.textContent).toBe('Sales connection metadata');
      expect(nodes(rels, 'Relationship').find((r) => r.getAttribute('TargetMode') === 'External')?.getAttribute('Target')).toBe('https://example.com/sales.odc');
      expect(nodes(await part(zip, '[Content_Types].xml'), 'Override').find((n) => n.getAttribute('PartName') === '/' + path)?.getAttribute('ContentType')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml');
    });
  });

  test('pivot data, field and cache custom formats resolve correctly after workbook styles are rebuilt', async () => {
    await roundTrips(await mediaWorkbookBlob({ pivotStyles: true }), async (zip, workbook) => {
      const styles = await part(zip, 'xl/styles.xml');
      const formats = nodes(styles, 'numFmts')[0]!.children;
      const codeFor = (node: Node) => formats.find((f) => f.getAttribute('numFmtId') === node.getAttribute('numFmtId'))?.getAttribute('formatCode');
      const pivot = await part(zip, 'xl/pivotTables/pivotTable1.xml');
      expect(codeFor(nodes(pivot, 'dataField')[0]!)).toBe('"$"#,##0.0000');
      expect(codeFor(nodes(pivot, 'pivotField')[1]!)).toBe('yyyy-mm-dd" UTC"');
      expect(codeFor(nodes(await part(zip, 'xl/pivotCache/pivotCacheDefinition1.xml'), 'cacheField')[1]!)).toBe('"$"#,##0.0000');
      expect(workbook.getWorksheet('Sales')!.getCell('C2').numFmt).toBe('0.00000');
      expect(new Set(formats.map((n) => n.getAttribute('numFmtId'))).size).toBe(formats.length);
    });
  });

  test('pivot differential formatting resolves to its own style alongside worksheet conditional formatting', async () => {
    await roundTrips(await mediaWorkbookBlob({ pivotStyles: true }), async (zip, workbook) => {
      const styles = await part(zip, 'xl/styles.xml');
      const pivot = await part(zip, 'xl/pivotTables/pivotTable1.xml');
      const dxfs = nodes(styles, 'dxfs')[0]!.children;
      const dxf = dxfs[Number(nodes(pivot, 'format')[0]!.getAttribute('dxfId'))];
      expect(dxf).toBeDefined();
      expect(dxf!.children.find((n) => n.name === 'font')!.children.find((n) => n.name === 'color')?.getAttribute('rgb')).toBe('FF009900');
      const numFmt = dxf!.children.find((n) => n.name === 'numFmt')!;
      expect(numFmt.getAttribute('formatCode')).toBe('"$"#,##0.0000');
      expect(nodes(styles, 'numFmts')[0]!.children.find((n) => n.getAttribute('numFmtId') === numFmt.getAttribute('numFmtId'))?.getAttribute('formatCode')).toBe('"$"#,##0.0000');
      expect(workbook.getWorksheet('Sales')!.conditionalFormattings[0]!.rules[0]!.style?.font?.bold).toBe(true);
      expect(Number(nodes(styles, 'dxfs')[0]!.getAttribute('count'))).toBe(dxfs.length);
    });
  });

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
