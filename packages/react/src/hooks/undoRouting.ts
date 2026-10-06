/**
 * Undo routing rules shared by OGrid (`useOGrid`) and the grid table
 * (`useDataGridInteraction`).
 *
 * A host that passes `onUndo` owns the history: Ctrl+Z and the context menu
 * call the host, and the grid's internal stack records nothing for formulas.
 * Without `onUndo` the grid keeps its own stack.
 */

/**
 * With host-owned undo and a formula engine, formula writes reach the host's
 * history as value changes whose value is the formula text, and the internal
 * stack stays out of the way (it would otherwise record the same change twice).
 */
export function usesHostFormulaHistory(hasHostUndo: boolean, hasFormulaCells: boolean): boolean {
  return hasHostUndo && hasFormulaCells;
}

/**
 * The formula engine follows formula text in the data when the host owns undo:
 * undoing a formula edit writes the formula text back into the host's rows, so
 * the data, not the engine, is the source of truth for which cells hold formulas.
 */
export function formulasFollowData(hasHostUndo: boolean): boolean {
  return hasHostUndo;
}

/**
 * Whether undo (or redo) is available: an explicit host flag wins, a host
 * handler without a flag is assumed available, otherwise the internal stack decides.
 */
export function resolveUndoAvailability(
  hostFlag: boolean | undefined,
  hasHostHandler: boolean,
  internalAvailable: boolean,
): boolean {
  return hostFlag ?? (hasHostHandler ? true : internalAvailable);
}
