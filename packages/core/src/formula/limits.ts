/** Hard limits for work performed by a single imported formula. */
export const MAX_FORMULA_LENGTH = 32_767;
export const MAX_FORMULA_DEPTH = 128;
/** Default per-formula work budget (cells read, nodes evaluated, text scanned). Configurable via `limits.maxWork`. */
export const MAX_FORMULA_STEPS = 20_000_000;
/** Default cells one formula may read from ranges. Configurable via `limits.maxRangeCells`. */
export const MAX_RANGE_CELLS = 5_000_000;
/** Steps one wildcard match may take (pattern parts x text length). */
export const MAX_WILDCARD_STEPS = 1_000_000;
export const MAX_MATRIX_SIZE = 64;
export const MAX_TEXT_LENGTH = 32_767;
