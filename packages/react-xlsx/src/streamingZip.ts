// Read only the ZIP directory and one small compressed slice at a time.
// No full-file ArrayBuffer and no inflated worksheet XML string are retained.
import { Inflate } from 'fflate';
import { SaxesParser } from 'saxes';
import { checkAbort, streamLimit } from './streamingTypes';

interface Entry { name: string; offset: number; compressed: number; size: number; method: number }

export class StreamingZip {
  readonly entries = new Map<string, Entry>();
  private inflated = 0;
  private constructor(private blob: Blob, private maxBytes: number, private signal?: AbortSignal) {}

  static async open(blob: Blob, maxBytes?: number, signal?: AbortSignal): Promise<StreamingZip> {
    checkAbort(signal);
    const zip = new StreamingZip(blob, streamLimit(maxBytes, 200 * 1024 ** 2), signal);
    const tailStart = Math.max(0, blob.size - 65557);
    const tail = new DataView(await blob.slice(tailStart).arrayBuffer());
    let end = -1;
    for (let i = tail.byteLength - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50 && i + 22 + tail.getUint16(i + 20, true) <= tail.byteLength) { end = i; break; }
    }
    if (end < 0) throw new Error('Invalid XLSX ZIP directory');
    let count = tail.getUint16(end + 10, true);
    let size = tail.getUint32(end + 12, true);
    let offset = tail.getUint32(end + 16, true);
    let directoryLimit = tailStart + end;
    if (tail.getUint32(end + 4, true) !== 0 || tail.getUint16(end + 8, true) !== count) throw new Error('Multi-volume XLSX files are not supported');
    const u64 = (v: DataView, p: number) => {
      const n = v.getUint32(p, true) + v.getUint32(p + 4, true) * 2 ** 32;
      if (!Number.isSafeInteger(n)) throw new Error('Invalid XLSX ZIP64 size');
      return n;
    };
    if (count === 65535 || size === 0xffffffff || offset === 0xffffffff) {
      if (end < 20 || tail.getUint32(end - 20, true) !== 0x07064b50) throw new Error('Invalid XLSX ZIP64 directory');
      const recordOffset = u64(tail, end - 12);
      const record = new DataView(await blob.slice(recordOffset, recordOffset + 56).arrayBuffer());
      if (record.byteLength !== 56 || record.getUint32(0, true) !== 0x06064b50) throw new Error('Invalid XLSX ZIP64 directory');
      count = u64(record, 32); size = u64(record, 40); offset = u64(record, 48); directoryLimit = recordOffset;
    }
    if (offset + size > directoryLimit) throw new Error('Invalid XLSX ZIP directory');
    if (size > zip.maxBytes) throw new Error(`XLSX exceeds maxUncompressedBytes (${zip.maxBytes})`);
    const bytes = new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer());
    const view = new DataView(bytes.buffer);
    let p = 0;
    let declared = 0;
    for (let i = 0; i < count; i++) {
      if (p + 46 > size || view.getUint32(p, true) !== 0x02014b50) throw new Error('Invalid XLSX ZIP entry');
      const nameLength = view.getUint16(p + 28, true);
      const extraLength = view.getUint16(p + 30, true);
      const next = p + 46 + nameLength + extraLength + view.getUint16(p + 32, true);
      if (next > size) throw new Error('Invalid XLSX ZIP entry');
      let uncompressed = view.getUint32(p + 24, true);
      let compressed = view.getUint32(p + 20, true);
      let localOffset = view.getUint32(p + 42, true);
      for (let x = p + 46 + nameLength; x + 4 <= p + 46 + nameLength + extraLength;) {
        const len = view.getUint16(x + 2, true);
        if (x + 4 + len > p + 46 + nameLength + extraLength) throw new Error('Invalid XLSX ZIP extra field');
        if (view.getUint16(x, true) === 1) {
          let q = x + 4;
          const read64 = () => { if (q + 8 > x + 4 + len) throw new Error('Invalid XLSX ZIP64 entry'); const n = u64(view, q); q += 8; return n; };
          if (uncompressed === 0xffffffff) uncompressed = read64();
          if (compressed === 0xffffffff) compressed = read64();
          if (localOffset === 0xffffffff) localOffset = read64();
        }
        x += 4 + len;
      }
      declared += uncompressed;
      if (declared > zip.maxBytes) throw new Error(`XLSX exceeds maxUncompressedBytes (${zip.maxBytes})`);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLength));
      const method = view.getUint16(p + 10, true);
      if ((view.getUint16(p + 8, true) & 1) || (method !== 0 && method !== 8)) throw new Error('Unsupported XLSX ZIP compression');
      if (zip.entries.has(name) || localOffset + 30 > offset) throw new Error('Invalid XLSX ZIP entry');
      zip.entries.set(name, { name, offset: localOffset, compressed, size: uncompressed, method });
      p = next;
    }
    if (p !== size) throw new Error('Invalid XLSX ZIP directory');
    return zip;
  }

  async xml(name: string, parser: SaxesParser, afterSlice?: () => Promise<void>, progress?: (bytes: number) => void): Promise<void> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`Missing XLSX part: ${name}`);
    const head = new DataView(await this.blob.slice(entry.offset, entry.offset + 30).arrayBuffer());
    if (head.byteLength !== 30 || head.getUint32(0, true) !== 0x04034b50) throw new Error('Invalid XLSX ZIP local header');
    const start = entry.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    if (start + entry.compressed > this.blob.size) throw new Error('Invalid XLSX ZIP payload');
    let actual = 0;
    const decoder = new TextDecoder();
    const consume = (data: Uint8Array, final: boolean) => {
      actual += data.length; this.inflated += data.length;
      if (actual > entry.size || this.inflated > this.maxBytes) throw new Error(`XLSX exceeds maxUncompressedBytes (${this.maxBytes})`);
      parser.write(decoder.decode(data, { stream: !final }));
    };
    const inflate = entry.method === 8 ? new Inflate(consume) : null;
    // Small slices bound inflate bursts, queued rows, and fallback task duration.
    const sliceBytes = 8192;
    for (let pos = 0; pos < entry.compressed; pos += sliceBytes) {
      checkAbort(this.signal);
      const end = Math.min(pos + sliceBytes, entry.compressed);
      const data = new Uint8Array(await this.blob.slice(start + pos, start + end).arrayBuffer());
      if (inflate) inflate.push(data, end === entry.compressed); else consume(data, end === entry.compressed);
      await afterSlice?.();
      progress?.(end);
      // Yield to paint and cancellation in the Worker-unavailable fallback.
      if (typeof document !== 'undefined') await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    checkAbort(this.signal);
    if (actual !== entry.size) throw new Error('Invalid XLSX ZIP uncompressed size');
    parser.close();
  }
}
