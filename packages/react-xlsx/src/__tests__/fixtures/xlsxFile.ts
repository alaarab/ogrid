import { Blob } from 'node:buffer';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function diskRoundTrip(blob: Blob): Promise<Blob> {
  const directory = await mkdtemp(join(tmpdir(), 'ogrid-streamed-'));
  try {
    const path = join(directory, 'workbook.xlsx');
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
    return new Blob([await readFile(path)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

