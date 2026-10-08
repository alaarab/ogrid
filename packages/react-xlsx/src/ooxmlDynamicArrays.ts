// Loaded only while exporting dynamic cells. ExcelJS does not model metadata.
import JSZip from 'jszip';
import type ExcelJS from 'exceljs';
import { dynamicCellsOf, sourceArchiveOf } from './sourceArchive';
import { children, descendants, element, MAIN_NS, PACKAGE_REL_NS, parseXml, relativePart, REL_NS, relId, resolvePart, xmlOf, type XmlElement } from './xmlParts';

const METADATA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml';
const DYNAMIC_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2017/dynamicarray';

async function read(zip: JSZip, path: string): Promise<XmlElement> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing OOXML part: ${path}`);
  return parseXml(await file.async('string'));
}

/** Retain all existing metadata records and append a shared dynamic record if needed. */
function dynamicRecord(metadata: XmlElement): string {
  metadata.attrs.xmlns ??= MAIN_NS;
  metadata.attrs['xmlns:xda'] ??= DYNAMIC_NS;
  let types = children(metadata, 'metadataTypes')[0];
  if (!types) { types = element('metadataTypes'); metadata.children.unshift(types); }
  let typeIndex = children(types).findIndex(type => type.attrs.name === 'XLDAPR');
  if (typeIndex < 0) {
    typeIndex = children(types).length;
    types.children.push(element('metadataType', {
      name: 'XLDAPR', minSupportedVersion: '120000', copy: '1', pasteAll: '1', pasteValues: '1',
      merge: '1', splitFirst: '1', rowColShift: '1', clearFormats: '1', clearComments: '1', assign: '1', coerce: '1', cellMeta: '1',
    }));
    types.attrs.count = String(children(types).length);
  }
  let future = children(metadata, 'futureMetadata').find(node => node.attrs.name === 'XLDAPR');
  if (!future) {
    future = element('futureMetadata', { name: 'XLDAPR', count: '0' });
    const at = metadata.children.findIndex(node => typeof node !== 'string' && ['cellMetadata', 'valueMetadata', 'extLst'].includes(node.name.split(':').pop() ?? ''));
    metadata.children.splice(at < 0 ? metadata.children.length : at, 0, future);
  }
  let futureIndex = children(future, 'bk').findIndex(block => descendants(block, 'dynamicArrayProperties').some(properties => properties.attrs.fDynamic === '1'));
  if (futureIndex < 0) {
    futureIndex = children(future, 'bk').length;
    future.children.push(element('bk', {}, [element('extLst', {}, [element('ext', { uri: '{bdbb8cdc-fa1e-496e-a857-3c3f30c029c3}' }, [
      element('xda:dynamicArrayProperties', { fDynamic: '1', fCollapsed: '0' }),
    ])])]));
    future.attrs.count = String(children(future, 'bk').length);
  }
  let records = children(metadata, 'cellMetadata')[0];
  if (!records) {
    records = element('cellMetadata', { count: '0' });
    const at = metadata.children.findIndex(node => typeof node !== 'string' && ['valueMetadata', 'extLst'].includes(node.name.split(':').pop() ?? ''));
    metadata.children.splice(at < 0 ? metadata.children.length : at, 0, records);
  }
  let recordIndex = children(records, 'bk').findIndex(block => children(block, 'rc').some(record => Number(record.attrs.t) === typeIndex + 1 && Number(record.attrs.v) === futureIndex));
  if (recordIndex < 0) {
    recordIndex = children(records, 'bk').length;
    records.children.push(element('bk', {}, [element('rc', { t: String(typeIndex + 1), v: String(futureIndex) })]));
    records.attrs.count = String(children(records, 'bk').length);
  }
  return String(recordIndex + 1); // cm is one-based; futureMetadata indexes are zero-based.
}

export async function writeDynamicArrays(workbook: ExcelJS.Workbook, output: ArrayBuffer): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(output);
  const source = sourceArchiveOf(workbook);
  const metadataPath = source?.metadataPath ?? 'xl/metadata.xml';
  const original = source?.metadataPath ? await JSZip.loadAsync(source.bytes) : undefined;
  const metadata = original ? await read(original, metadataPath) : element('metadata', { xmlns: MAIN_NS });
  const book = await read(zip, 'xl/workbook.xml');
  const rels = await read(zip, 'xl/_rels/workbook.xml.rels');
  let generatedRecord: string | undefined;
  let written = false;
  for (const sheet of descendants(book, 'sheet')) {
    const name = sheet.attrs.name ?? '';
    const markers = dynamicCellsOf(workbook)?.get(name);
    if (!markers?.size) continue;
    const rel = children(rels).find(node => node.attrs.Id === relId(sheet));
    if (!rel) continue;
    const path = resolvePart('xl/workbook.xml', rel.attrs.Target ?? '');
    const xml = await read(zip, path);
    for (const cell of descendants(xml, 'c')) {
      const marker = markers.get(cell.attrs.r ?? '');
      const formula = workbook.getWorksheet(name)?.getCell(cell.attrs.r ?? 'A1').formula;
      if (!marker || !formula || marker.formula !== formula) continue;
      cell.attrs.cm = marker.cm ?? (generatedRecord ??= dynamicRecord(metadata));
      written = true;
    }
    zip.file(path, xmlOf(xml));
  }
  // Existing metadata can hold other record types; retain it even when the
  // last dynamic anchor was cleared. Removed anchors receive no cm attribute.
  if (written || original) {
    zip.file(metadataPath, xmlOf(metadata));
    const ids = new Set(children(rels).map(node => node.attrs.Id));
    let id = 'rIdMetadata';
    while (ids.has(id)) id += '_';
    rels.children.push(element('Relationship', { Id: id, Type: `${REL_NS}/sheetMetadata`, Target: relativePart('xl/workbook.xml', metadataPath) }));
    rels.attrs.xmlns ??= PACKAGE_REL_NS;
    zip.file('xl/_rels/workbook.xml.rels', xmlOf(rels));
    const types = await read(zip, '[Content_Types].xml');
    if (!children(types).some(node => node.attrs.PartName === '/' + metadataPath)) {
      types.children.push(element('Override', { PartName: '/' + metadataPath, ContentType: METADATA_TYPE }));
    }
    zip.file('[Content_Types].xml', xmlOf(types));
  }
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}
