import { SaxesParser } from 'saxes';

export const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const PACKAGE_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
export const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
export const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  attrUris: Record<string, string>;
  children: Array<XmlElement | string>;
}
export function element(name: string, attrs: Record<string, string> = {}, children: XmlElement[] = []): XmlElement {
  return { name, attrs, attrUris: {}, children };
}
export function localName(node: XmlElement): string { return node.name.split(':').pop() ?? node.name; }
export function children(node: XmlElement, name?: string): XmlElement[] {
  return node.children.filter((c): c is XmlElement => typeof c !== 'string' && (!name || localName(c) === name));
}
export function descendants(node: XmlElement, name: string): XmlElement[] {
  return children(node).flatMap((c) => [...(localName(c) === name ? [c] : []), ...descendants(c, name)]);
}
export function textOf(node: XmlElement): string {
  return node.children.map((c) => typeof c === 'string' ? c : textOf(c)).join('');
}
export function parseXml(xml: string): XmlElement {
  const parser = new SaxesParser({ xmlns: true });
  const stack: XmlElement[] = [];
  let root: XmlElement | undefined;
  parser.on('doctype', () => { throw new Error('OOXML must not contain a DOCTYPE'); });
  parser.on('opentag', (tag) => {
    const node = element(tag.name);
    for (const attr of Object.values(tag.attributes)) {
      node.attrs[attr.name] = attr.value;
      node.attrUris[attr.name] = attr.uri;
    }
    if (stack.length) stack[stack.length - 1]?.children.push(node);
    else root = node;
    stack.push(node);
  });
  const addText = (s: string) => { stack[stack.length - 1]?.children.push(s); };
  parser.on('text', addText);
  parser.on('cdata', addText);
  parser.on('closetag', () => { stack.pop(); });
  parser.write(xml).close();
  if (!root) throw new Error('Empty OOXML part');
  return root;
}
function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\r/g, '&#13;');
}
export function xmlOf(node: XmlElement): string {
  const attrs = Object.entries(node.attrs).map(([k, v]) => ` ${k}="${escapeXml(v).replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')}"`).join('');
  return `<${node.name}${attrs}>${node.children.map((c) => typeof c === 'string' ? escapeXml(c) : xmlOf(c)).join('')}</${node.name}>`;
}
export function relId(node: XmlElement): string | undefined {
  return Object.entries(node.attrs).find(([k]) => node.attrUris[k] === REL_NS && k.endsWith(':id'))?.[1];
}
export function setRelId(node: XmlElement, id: string): void {
  const key = Object.keys(node.attrs).find((k) => node.attrUris[k] === REL_NS && k.endsWith(':id'));
  if (key) node.attrs[key] = id;
  else { node.attrs['xmlns:r'] = REL_NS; node.attrs['r:id'] = id; node.attrUris['r:id'] = REL_NS; }
}
export function resolvePart(owner: string, target: string): string {
  const parts = (target.startsWith('/') ? target.slice(1) : owner.slice(0, owner.lastIndexOf('/') + 1) + target).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}
export function relativePart(owner: string, target: string): string {
  const from = owner.split('/').slice(0, -1);
  const to = target.split('/');
  while (from.length && from[0] === to[0]) { from.shift(); to.shift(); }
  return '../'.repeat(from.length) + to.join('/');
}
export function relsPath(owner: string): string {
  const index = owner.lastIndexOf('/');
  return `${owner.slice(0, index + 1)}_rels/${owner.slice(index + 1)}.rels`;
}
