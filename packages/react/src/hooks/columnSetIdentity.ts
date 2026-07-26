/**
 * Column-set identity helpers.
 *
 * Several OGrid state hooks key their state on column ids (visible set, pin
 * positions). Any of them can go stale when the `columns` prop is swapped
 * wholesale  -  async-loaded column defs, a sheet switch, a host that rebuilds
 * its columns from a different schema. They all need the same question answered
 * during render: "is this the same column set I last reconciled against?"
 */

/** Column ids in order. Callers keep the result in state to compare next render. */
export function columnIdsOf(columns: ReadonlyArray<{ columnId: string }>): string[] {
  return columns.map((c) => c.columnId);
}

/** True when `columns` has exactly the ids in `prevIds`, in the same order. */
export function sameColumnIds(
  prevIds: readonly string[],
  columns: ReadonlyArray<{ columnId: string }>
): boolean {
  if (prevIds.length !== columns.length) return false;
  for (let i = 0; i < prevIds.length; i++) {
    if (prevIds[i] !== columns[i]?.columnId) return false;
  }
  return true;
}
