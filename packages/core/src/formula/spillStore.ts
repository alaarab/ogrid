import { FormulaError, type CellKey, type ISpillRange, type IGridDataAccessor } from './types';
import { fromCellKey, toCellKey } from './cellAddressUtils';

/** Array ownership is separate from source data and from formula storage. */
export class SpillStore {
  readonly ranges = new Map<CellKey, ISpillRange>();
  readonly attempts = new Map<CellKey, ISpillRange>();
  readonly arrays = new Map<CellKey, unknown[][]>();
  readonly owners = new Map<CellKey, CellKey>();

  getRange(col: number, row: number): ISpillRange | undefined {
    const key = toCellKey(col, row);
    return this.ranges.get(this.owners.get(key) ?? key);
  }

  getValue(key: CellKey): unknown {
    const owner = this.owners.get(key);
    const range = owner && this.ranges.get(owner);
    const cell = fromCellKey(key);
    return range && this.arrays.get(owner)?.[cell.row - range.anchorRow]?.[cell.col - range.anchorCol];
  }

  children(key: CellKey): CellKey[] {
    const range = this.ranges.get(key);
    if (!range) return [];
    const children: CellKey[] = [];
    for (let row = range.anchorRow; row <= range.endRow; row++) for (let col = range.anchorCol; col <= range.endCol; col++) {
      const cell = toCellKey(col, row);
      if (cell !== key) children.push(cell);
    }
    return children;
  }

  remove(key: CellKey): void {
    for (const child of this.children(key)) this.owners.delete(child);
    this.ranges.delete(key);
    this.arrays.delete(key);
    this.attempts.delete(key);
  }

  /** Anchors whose output (including a blocked output) intersects these changes. */
  affected(keys: Iterable<CellKey>, outputsChanged = false): Set<CellKey> {
    const result = new Set<CellKey>();
    for (const key of keys) {
      const { col, row, sheet } = fromCellKey(key);
      if (sheet) continue;
      for (const [anchor, range] of this.attempts) {
        if (outputsChanged && this.owners.get(key) === anchor) continue;
        if (key !== anchor && col >= range.anchorCol && col <= range.endCol && row >= range.anchorRow && row <= range.endRow) result.add(anchor);
      }
    }
    return result;
  }

  put(key: CellKey, result: unknown, accessor: IGridDataAccessor, hasFormula: (key: CellKey) => boolean): unknown {
    if (!Array.isArray(result)) return result;
    const { col, row } = fromCellKey(key);
    const array = result as unknown[][];
    const width = array[0]?.length ?? 0;
    if (!array.length || !width) return new FormulaError('#CALC!', 'Empty array');
    if (array.some(r => !Array.isArray(r) || r.length !== width)) return new FormulaError('#VALUE!', 'Array must be rectangular');
    const range = { anchorCol: col, anchorRow: row, endCol: col + width - 1, endRow: row + array.length - 1 };
    this.attempts.set(key, range);
    if (range.endCol >= 16384 || range.endRow >= 1048576) return new FormulaError('#SPILL!', 'Spill exceeds worksheet bounds');
    for (let r = row; r <= range.endRow; r++) for (let c = col; c <= range.endCol; c++) {
      const child = toCellKey(c, r);
      if (accessor.isCellMerged?.(c, r)) return new FormulaError('#SPILL!', 'Spill intersects merged cells');
      if (child === key) continue;
      const raw = c < accessor.getColumnCount() && r < accessor.getRowCount() ? accessor.getCellValue(c, r) : undefined;
      if (hasFormula(child) || accessor.isCellOccupied?.(c, r) || this.owners.has(child) || (raw !== undefined && raw !== null && raw !== '')) return new FormulaError('#SPILL!', 'Spill range is blocked');
    }
    this.ranges.set(key, range);
    this.arrays.set(key, array);
    for (let r = row; r <= range.endRow; r++) for (let c = col; c <= range.endCol; c++) {
      const child = toCellKey(c, r);
      if (child !== key) this.owners.set(child, key);
    }
    return array[0]?.[0] ?? 0;
  }

  clear(): void {
    this.ranges.clear(); this.attempts.clear(); this.arrays.clear(); this.owners.clear();
  }
}
