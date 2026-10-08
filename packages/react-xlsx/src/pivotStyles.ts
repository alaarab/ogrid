import { children, element, localName, xmlOf, type XmlElement } from './xmlParts';

/** Merge only styles referenced by preserved pivots into the rebuilt tables. */
export function pivotStyleRemapper(source: XmlElement, output: XmlElement): (part: XmlElement) => void {
  const numFormats = new Map(children(children(source, 'numFmts')[0] ?? element('numFmts')).map((n) => [n.attrs.numFmtId, n]));
  const sourceDxfs = children(children(source, 'dxfs')[0] ?? element('dxfs'));
  const formatIds = new Map<string, string>();
  const dxfIds = new Map<string, string>();
  const table = (name: string): XmlElement => {
    let node = children(output, name)[0];
    if (!node) {
      node = element(name, { count: '0' });
      const successors = name === 'numFmts' ? ['fonts', 'fills', 'borders', 'cellStyleXfs', 'cellXfs', 'cellStyles', 'dxfs', 'tableStyles', 'colors', 'extLst'] : ['tableStyles', 'colors', 'extLst'];
      const index = output.children.findIndex((c) => typeof c !== 'string' && successors.includes(localName(c)));
      output.children.splice(index < 0 ? output.children.length : index, 0, node);
    }
    return node;
  };
  const remapFormat = (id: string, inlineCode?: string): string => {
    const previous = formatIds.get(id);
    if (previous) return previous;
    const original = numFormats.get(id);
    const code = original?.attrs.formatCode ?? inlineCode;
    if (code === undefined) {
      if (Number(id) < 164) return id; // Standard formats retain their IDs.
      throw new Error(`Missing preserved pivot number format: ${id}`);
    }
    const formats = table('numFmts');
    const existing = children(formats).find((n) => n.attrs.formatCode === code);
    const next = existing?.attrs.numFmtId ?? String(Math.max(163, ...children(formats).map((n) => Number(n.attrs.numFmtId))) + 1);
    if (!existing) {
      formats.children.push(element('numFmt', { numFmtId: next, formatCode: code }));
      formats.attrs.count = String(children(formats).length);
    }
    formatIds.set(id, next);
    return next;
  };
  const remapDxf = (id: string): string => {
    const previous = dxfIds.get(id);
    if (previous !== undefined) return previous;
    const original = sourceDxfs[Number(id)];
    if (!original) throw new Error(`Missing preserved pivot differential style: ${id}`);
    remap(original);
    // Preserve inherited prefixes used by extension style components.
    for (const [key, value] of Object.entries(source.attrs)) {
      if (key === 'xmlns' || key.startsWith('xmlns:')) original.attrs[key] ??= value;
    }
    const dxfs = table('dxfs');
    const existing = children(dxfs).findIndex((n) => xmlOf(n) === xmlOf(original));
    const next = String(existing < 0 ? children(dxfs).length : existing);
    if (existing < 0) dxfs.children.push(original);
    dxfs.attrs.count = String(children(dxfs).length);
    dxfIds.set(id, next);
    return next;
  };
  const remap = (node: XmlElement): void => {
    for (const [key, value] of Object.entries(node.attrs)) {
      const name = key.split(':').pop();
      if (name === 'numFmtId') node.attrs[key] = remapFormat(value, node.attrs.formatCode);
      else if (name === 'dxfId' || name?.endsWith('DxfId')) node.attrs[key] = remapDxf(value);
    }
    for (const child of children(node)) remap(child);
  };
  return remap;
}
