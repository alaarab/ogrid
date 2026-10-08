// Loaded on XLSX read/write only. ExcelJS loses sqref origins and coerces
// numeric/date formula bounds; retain their actual OOXML representations.
import type ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { parseRange } from '@alaarab/ogrid-core/formula';
import { indexToColumnLetter } from '@alaarab/ogrid-core';
import { validationRanges } from './workbookStructure';
import type { AnchoredValidation } from './dataValidation';
import { children, descendants, element, parseXml, resolvePart, textOf, xmlOf } from './xmlParts';

const VALIDATIONS = /<(?:\w+:)?dataValidations\b[^>]*>[\s\S]*?<\/(?:\w+:)?dataValidations>/;
type ValidationSheet = ExcelJS.Worksheet & { dataValidations: { model: Record<string, ExcelJS.DataValidation> } };

async function sheetParts(zip: JSZip): Promise<Map<string, string>> {
  const workbookPart = zip.file('xl/workbook.xml'), relsPart = zip.file('xl/_rels/workbook.xml.rels');
  if (!workbookPart || !relsPart) throw new Error('Missing XLSX workbook relationships');
  const workbook = parseXml(await workbookPart.async('string'));
  const rels = parseXml(await relsPart.async('string'));
  const targets = new Map(children(rels).map(node => [node.attrs.Id, resolvePart('xl/workbook.xml', node.attrs.Target ?? '')]));
  return new Map(descendants(workbook, 'sheet').map(node => [node.attrs.name ?? '', targets.get(node.attrs['r:id']) ?? '']));
}

export async function readValidationXml(workbook: ExcelJS.Workbook, bytes: ArrayBuffer): Promise<void> {
  const zip = await JSZip.loadAsync(bytes), parts = await sheetParts(zip);
  for (const sheet of workbook.worksheets) {
    const path = parts.get(sheet.name), file = path ? zip.file(path) : null;
    if (!file) continue;
    const xml = await file.async('string'), fragment = VALIDATIONS.exec(xml)?.[0];
    if (!fragment) continue;
    const namespaces = xml.match(/xmlns(?::[\w.-]+)?="[^"]*"/g)?.join(' ') ?? '';
    const root = parseXml(`<root ${namespaces}>${fragment}</root>`);
    const model: Record<string, ExcelJS.DataValidation> = {};
    for (const node of descendants(root, 'dataValidation')) {
      const { sqref, ...attrs } = node.attrs;
      const formulae = children(node).map(formula => {
        const body = textOf(formula);
        return !['list', 'custom'].includes(attrs.type ?? '') && body.trim() !== '' && Number.isFinite(Number(body)) ? Number(body) : body;
      });
      const first = sqref?.split(/\s+/)[0] ?? '';
      const origin = parseRange(`${first.split(':')[0]}:${first.split(':')[0]}`)?.start;
      const rule = { ...attrs, type: attrs.type || 'any', formulae, _ogridOrigin: origin ? { col: origin.col, row: origin.row } : undefined } as unknown as AnchoredValidation;
      for (const key of ['allowBlank', 'showInputMessage', 'showErrorMessage', 'showDropDown'] as const) {
        rule[key] = attrs[key] === '1' || attrs[key] === 'true';
      }
      for (const ref of sqref?.split(/\s+/) ?? []) {
        const range = parseRange(ref.includes(':') ? ref : `${ref}:${ref}`);
        if (!range) continue;
        for (let row = range.start.row; row <= range.end.row; row++) {
          for (let col = range.start.col; col <= range.end.col; col++) model[`${indexToColumnLetter(col)}${row + 1}`] = rule;
        }
      }
    }
    (sheet as ValidationSheet).dataValidations.model = model;
  }
}

export async function writeValidationXml(workbook: ExcelJS.Workbook, bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  const zip = await JSZip.loadAsync(bytes), parts = await sheetParts(zip);
  for (const sheet of workbook.worksheets) {
    const model = (sheet as ValidationSheet).dataValidations.model;
    if (!Object.keys(model).length) continue;
    const path = parts.get(sheet.name), file = path ? zip.file(path) : null;
    if (!path || !file) continue;
    const rules = validationRanges(model).map(([sqref, rule]) => {
      const attrs: Record<string, string> = { sqref };
      if (rule.type && String(rule.type) !== 'any') attrs.type = rule.type;
      for (const [key, value] of Object.entries(rule)) {
        if (key === 'formulae' || key === 'type' || key === '_ogridOrigin' || value === undefined) continue;
        attrs[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
      }
      const node = element('dataValidation', attrs);
      node.children = (rule.formulae ?? []).map((bound: unknown, index) => {
        const formula = element(`formula${index + 1}`);
        formula.children = [String(bound instanceof Date ? bound.getTime() / 86400000 + 25569 : bound)];
        return formula;
      });
      return node;
    });
    const xml = await file.async('string'), fragment = xmlOf(element('dataValidations', { count: String(rules.length) }, rules));
    zip.file(path, VALIDATIONS.test(xml) ? xml.replace(VALIDATIONS, () => fragment) : xml.replace('</worksheet>', `${fragment}</worksheet>`));
  }
  return new Uint8Array(await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }));
}
