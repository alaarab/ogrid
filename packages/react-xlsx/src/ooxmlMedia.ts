import JSZip from 'jszip';
import type ExcelJS from 'exceljs';
import { markDynamicArray, type ChartAnchor, type SourceArchive } from './sourceArchive';
import { EMUS_PER_PIXEL, nativeMediaPoint } from './mediaGeometry';
import { pivotStyleRemapper } from './pivotStyles';
import {
  children, descendants, DRAWING_NS, element, localName, PACKAGE_REL_NS,
  parseXml, relativePart, REL_NS, relId, relsPath, resolvePart, setRelId, textOf, xmlOf, type XmlElement,
} from './xmlParts';

async function read(zip: JSZip, path: string): Promise<XmlElement> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing OOXML part: ${path}`);
  return parseXml(await file.async('string'));
}
async function relationships(zip: JSZip, owner: string): Promise<XmlElement> {
  return zip.file(relsPath(owner)) ? read(zip, relsPath(owner)) : element('Relationships', { xmlns: PACKAGE_REL_NS });
}
function findRel(rels: XmlElement, id: string | undefined): XmlElement | undefined {
  return children(rels).find((r) => r.attrs.Id === id);
}
async function sheets(zip: JSZip): Promise<Map<string, string>> {
  const workbook = await read(zip, 'xl/workbook.xml');
  const rels = await relationships(zip, 'xl/workbook.xml');
  const out = new Map<string, string>();
  for (const sheet of descendants(workbook, 'sheet')) {
    const rel = findRel(rels, relId(sheet));
    if (rel) out.set(sheet.attrs.name ?? "", resolvePart('xl/workbook.xml', rel.attrs.Target ?? ""));
  }
  return out;
}
function namespaces(from: XmlElement, to: XmlElement): void {
  // Carry inherited bindings onto copied subtrees, including uncommon prefixes.
  for (const [key, value] of Object.entries(from.attrs)) {
    if (key === 'xmlns' || key.startsWith('xmlns:')) to.attrs[key] ??= value;
  }
}
function marker(anchor: XmlElement, name: string, worksheet: ExcelJS.Worksheet): { col: number; row: number } | undefined {
  const node = children(anchor, name)[0];
  if (!node) return undefined;
  const number = (key: string) => Number(textOf(children(node, key)[0] ?? element(key)));
  return nativeMediaPoint(worksheet, { nativeCol: number('col'), nativeRow: number('row'), nativeColOff: number('colOff'), nativeRowOff: number('rowOff') });
}

/** Read chart placeholders while the original ZIP is still available. */
export async function readSourceArchive(bytes: ArrayBuffer, workbook: ExcelJS.Workbook): Promise<SourceArchive | undefined> {
  const zip = await JSZip.loadAsync(bytes);
  const workbookRels = await relationships(zip, 'xl/workbook.xml');
  const metadataRel = children(workbookRels).find(r => r.attrs.Type?.endsWith('/sheetMetadata'));
  const metadataPath = metadataRel && resolvePart('xl/workbook.xml', metadataRel.attrs.Target ?? '');
  if (!metadataPath && !zip.file(/^xl\/(charts|pivotTables|pivotCache)\/[^/]+\.xml$/).length) return undefined;
  const charts = new Map<string, ChartAnchor[]>();
  for (const [name, path] of await sheets(zip)) {
    const worksheet = workbook.getWorksheet(name);
    if (!worksheet) continue;
    const sheet = await read(zip, path);
    if (metadataPath) {
      for (const cell of descendants(sheet, 'c')) {
        if (cell.attrs.cm && cell.attrs.r && worksheet.getCell(cell.attrs.r).formula) markDynamicArray(worksheet, cell.attrs.r, cell.attrs.cm);
      }
    }
    const rels = await relationships(zip, path);
    const rel = findRel(rels, relId(children(sheet, 'drawing')[0] ?? element('drawing')));
    if (!rel) continue;
    const drawingPath = resolvePart(path, rel.attrs.Target ?? "");
    const drawing = await read(zip, drawingPath);
    const drawingRels = await relationships(zip, drawingPath);
    const anchors: ChartAnchor[] = [];
    for (const anchor of children(drawing)) {
      const chart = descendants(anchor, 'chart')[0];
      const chartRel = chart && findRel(drawingRels, relId(chart));
      const tl = marker(anchor, 'from', worksheet);
      if (!chartRel || !tl) continue;
      const part = await read(zip, resolvePart(drawingPath, chartRel.attrs.Target ?? ""));
      const title = descendants(part, 'title')[0];
      const titleText = title ? descendants(title, 't').map(textOf).join('') || descendants(title, 'v').map(textOf).join('') : '';
      const ext = children(anchor, 'ext')[0];
      anchors.push({
        title: titleText || 'Untitled chart', tl, br: marker(anchor, 'to', worksheet),
        ...(ext ? { ext: { width: Number(ext.attrs.cx) / EMUS_PER_PIXEL, height: Number(ext.attrs.cy) / EMUS_PER_PIXEL } } : {}),
      });
    }
    if (anchors.length) charts.set(name, anchors);
  }
  return {
    bytes, charts, metadataPath,
    sheets: new Map(workbook.worksheets.map((ws) => [ws.name, { rows: ws.rowCount, columns: ws.columnCount }])),
  };
}

/** Restore unsupported parts to an ExcelJS export, retaining its image drawings. */
export async function preserveMedia(source: SourceArchive, output: ArrayBuffer, workbook: ExcelJS.Workbook): Promise<Uint8Array<ArrayBuffer>> {
  const original = await JSZip.loadAsync(source.bytes);
  const out = await JSZip.loadAsync(output);
  const originalTypes = await read(original, '[Content_Types].xml');
  const types = await read(out, '[Content_Types].xml');
  const copied = new Map<string, string>();
  const connectionIds = new Set<string>();
  let styles: XmlElement | undefined;
  let remapStyles: ((part: XmlElement) => void) | undefined;
  const reserved = new Set(Object.keys(out.files));
  const unique = (path: string) => {
    let candidate = path;
    let n = 1;
    while (reserved.has(candidate)) {
      const numbered = path.match(/(\d+)(\.[^/.]+)$/);
      candidate = numbered
        ? path.replace(/\d+(\.[^/.]+)$/, `${Number(numbered[1]) + n}$1`)
        : /\.[^/.]+$/.test(path) ? path.replace(/(\.[^/.]+)$/, `ogrid${n}$1`) : `${path}ogrid${n}`;
      n++;
    }
    reserved.add(candidate);
    return candidate;
  };
  const addType = (from: string, to: string) => {
    const override = children(originalTypes, 'Override').find((c) => c.attrs.PartName === '/' + from);
    if (override && !children(types, 'Override').some((c) => c.attrs.PartName === '/' + to)) {
      types.children.push(element('Override', { ...override.attrs, PartName: '/' + to }));
    }
    const extension = from.split('.').pop();
    const def = children(originalTypes, 'Default').find((c) => c.attrs.Extension === extension);
    if (def && !children(types, 'Default').some((c) => c.attrs.Extension === extension)) types.children.push(def);
  };
  // Copy a part's entire relationship graph (styles, colors, media, embedded
  // workbooks, cache records, etc.). Rewrite targets if an output path exists.
  const copyPart = async (path: string): Promise<string> => {
    const previous = copied.get(path);
    if (previous) return previous;
    const file = original.file(path);
    if (!file) throw new Error(`Missing preserved OOXML part: ${path}`);
    const target = unique(path);
    copied.set(path, target);
    let data: string | Uint8Array = await file.async('uint8array');
    const contentType = children(originalTypes, 'Override').find((node) => node.attrs.PartName === '/' + path)?.attrs.ContentType;
    // Cache records can contain millions of entries and have no style IDs.
    // Keep those bytes intact; only definitions need their references remapped.
    if (contentType?.endsWith('.pivotTable+xml') || contentType?.endsWith('.pivotCacheDefinition+xml')) {
      const pivot = parseXml(await file.async('string'));
      if (!remapStyles) {
        styles = await read(out, 'xl/styles.xml');
        remapStyles = pivotStyleRemapper(await read(original, 'xl/styles.xml'), styles);
      }
      remapStyles(pivot);
      if (localName(pivot) === 'pivotCacheDefinition') {
        pivot.attrs.refreshOnLoad = '1';
        for (const cacheSource of descendants(pivot, 'cacheSource')) {
          if (cacheSource.attrs.type === 'external' && cacheSource.attrs.connectionId) connectionIds.add(cacheSource.attrs.connectionId);
        }
      }
      data = xmlOf(pivot);
    }
    out.file(target, data);
    addType(path, target);
    if (original.file(relsPath(path))) {
      const rels = await relationships(original, path);
      for (const rel of children(rels)) {
        if (rel.attrs.TargetMode === 'External') continue;
        rel.attrs.Target = relativePart(target, await copyPart(resolvePart(path, rel.attrs.Target ?? "")));
      }
      out.file(relsPath(target), xmlOf(rels));
    }
    return target;
  };
  const appendRel = (rels: XmlElement, type: string, target: string, mode?: string) => {
    const ids = new Set(children(rels).map((r) => r.attrs.Id));
    let n = 1;
    while (ids.has(`rId${n}`)) n++;
    const id = `rId${n}`;
    rels.children.push(element('Relationship', { Id: id, Type: type, Target: target, ...(mode ? { TargetMode: mode } : {}) }));
    return id;
  };
  const transferRel = async (rel: XmlElement, from: string, to: string, rels: XmlElement) => appendRel(
    rels, rel.attrs.Type ?? "",
    rel.attrs.TargetMode === 'External' ? (rel.attrs.Target ?? '') : relativePart(to, await copyPart(resolvePart(from, rel.attrs.Target ?? ""))),
    rel.attrs.TargetMode,
  );
  const originalSheets = await sheets(original);
  const outputSheets = await sheets(out);
  for (const [name, path] of originalSheets) {
    const outputPath = outputSheets.get(name);
    if (!outputPath) continue;
    const sheet = await read(original, path);
    const newSheet = await read(out, outputPath);
    const rels = await relationships(original, path);
    const newRels = await relationships(out, outputPath);
    const drawingRef = children(sheet, 'drawing')[0];
    const drawingRel = drawingRef && findRel(rels, relId(drawingRef));
    if (drawingRel) {
      const drawingPath = resolvePart(path, drawingRel.attrs.Target ?? "");
      const drawing = await read(original, drawingPath);
      const anchors = children(drawing).filter((a) => descendants(a, 'chart').length > 0);
      if (anchors.length) {
        let ref = children(newSheet, 'drawing')[0];
        const existingRel = ref && findRel(newRels, relId(ref));
        const newDrawingPath = existingRel ? resolvePart(outputPath, existingRel.attrs.Target ?? "") : unique('xl/drawings/drawing1.xml');
        const newDrawing = existingRel ? await read(out, newDrawingPath) : element('xdr:wsDr', { 'xmlns:xdr': DRAWING_NS });
        const newDrawingRels = await relationships(out, newDrawingPath);
        const drawingRels = await relationships(original, drawingPath);
        const remapped = new Map<string, string>();
        let nonVisualId = Math.max(0, ...descendants(newDrawing, 'cNvPr').map((n) => Number(n.attrs.id) || 0));
        for (const anchor of anchors) {
          namespaces(drawing, anchor);
          const visit = async (node: XmlElement): Promise<void> => {
            if (localName(node) === 'cNvPr') node.attrs.id = String(++nonVisualId);
            for (const key of Object.keys(node.attrs)) {
              if (node.attrUris[key] !== REL_NS) continue;
              const oldId = node.attrs[key] ?? "";
              let id = remapped.get(oldId);
              if (!id) {
                const rel = findRel(drawingRels, oldId);
                if (!rel) throw new Error(`Missing drawing relationship: ${oldId}`);
                id = await transferRel(rel, drawingPath, newDrawingPath, newDrawingRels);
                remapped.set(oldId, id);
              }
              node.attrs[key] = id;
            }
            for (const child of children(node)) await visit(child);
          };
          await visit(anchor);
          newDrawing.children.push(anchor);
        }
        out.file(newDrawingPath, xmlOf(newDrawing));
        out.file(relsPath(newDrawingPath), xmlOf(newDrawingRels));
        addType(drawingPath, newDrawingPath);
        if (!ref) {
          ref = element('drawing');
          setRelId(ref, appendRel(newRels, drawingRel.attrs.Type ?? "", relativePart(outputPath, newDrawingPath)));
          // drawing precedes legacyDrawing/tableParts/extLst in worksheet schema.
          const index = newSheet.children.findIndex((c) => typeof c !== 'string' && ['legacyDrawing', 'legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'].includes(localName(c)));
          newSheet.children.splice(index < 0 ? newSheet.children.length : index, 0, ref);
        }
      }
    }
    // Excel normally links pivots implicitly through sheet relationships,
    // without a pivotTableParts element in the worksheet XML.
    const pivotIds = new Map<string, string>();
    for (const rel of children(rels).filter((r) => r.attrs.Type?.endsWith('/pivotTable'))) {
      pivotIds.set(rel.attrs.Id ?? '', await transferRel(rel, path, outputPath, newRels));
    }
    const pivots = children(sheet, 'pivotTableParts')[0];
    if (pivots) {
      namespaces(sheet, pivots);
      for (const pivot of children(pivots)) {
        const rel = findRel(rels, relId(pivot));
        if (!rel) throw new Error('Missing pivot table relationship');
        setRelId(pivot, pivotIds.get(rel.attrs.Id ?? '') ?? await transferRel(rel, path, outputPath, newRels));
      }
      // pivotTableParts is an extension used by Excel; keep it before extLst.
      const index = newSheet.children.findIndex((c) => typeof c !== 'string' && localName(c) === 'extLst');
      newSheet.children.splice(index < 0 ? newSheet.children.length : index, 0, pivots);
    }
    out.file(outputPath, xmlOf(newSheet));
    if (children(newRels).length) out.file(relsPath(outputPath), xmlOf(newRels));
  }
  const originalWorkbook = await read(original, 'xl/workbook.xml');
  const caches = children(originalWorkbook, 'pivotCaches')[0];
  if (caches) {
    const wb = await read(out, 'xl/workbook.xml');
    const rels = await relationships(original, 'xl/workbook.xml');
    const newRels = await relationships(out, 'xl/workbook.xml');
    namespaces(originalWorkbook, caches);
    for (const cache of children(caches)) {
      const rel = findRel(rels, relId(cache));
      if (!rel) throw new Error('Missing pivot cache relationship');
      setRelId(cache, await transferRel(rel, 'xl/workbook.xml', 'xl/workbook.xml', newRels));
    }
    if (connectionIds.size) {
      const rel = children(rels).find((r) => r.attrs.Type?.endsWith('/connections'));
      if (!rel) throw new Error('Missing external pivot connections relationship');
      const connections = await read(original, resolvePart('xl/workbook.xml', rel.attrs.Target ?? ''));
      for (const id of connectionIds) {
        if (!children(connections, 'connection').some((c) => c.attrs.id === id)) throw new Error(`Missing external pivot connection: ${id}`);
      }
      await transferRel(rel, 'xl/workbook.xml', 'xl/workbook.xml', newRels);
    }
    // pivotCaches follows calcPr and precedes the remaining workbook children.
    const index = wb.children.findIndex((c) => typeof c !== 'string' && ['oleSize', 'customWorkbookViews', 'smartTagPr', 'smartTagTypes', 'webPublishing', 'fileRecoveryPr', 'webPublishObjects', 'extLst'].includes(localName(c)));
    wb.children.splice(index < 0 ? wb.children.length : index, 0, caches);
    out.file('xl/workbook.xml', xmlOf(wb));
    out.file(relsPath('xl/workbook.xml'), xmlOf(newRels));
  }
  if (styles) out.file('xl/styles.xml', xmlOf(styles));
  out.file('[Content_Types].xml', xmlOf(types));
  // A1 references in chart/pivot parts are deliberately untouched. Structural
  // edits outside this document need a range-rewriting implementation.
  for (const [name, extent] of source.sheets) {
    const ws = workbook.getWorksheet(name);
    if (ws && (ws.rowCount !== extent.rows || ws.columnCount !== extent.columns)) {
      console.warn(`OGrid: ${name} changed size; preserved chart and pivot ranges may need adjustment in Excel.`);
    }
  }
  return new Uint8Array(await out.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}
