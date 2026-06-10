import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './AnimatedGridDemo.module.scss';

/* ──────────────────────────────────────────────
   Data
   ────────────────────────────────────────────── */

const COLUMNS = ['', 'A', 'B', 'C', 'D', 'E'];

const ROWS = [
  { id: 0, a: 'Q1 Sales', b: 38, c: 45, d: 59 },
  { id: 1, a: 'Q2 Sales', b: 42, c: 31, d: 69 },
  { id: 2, a: 'Q3 Sales', b: 51, c: 28, d: 74 },
  { id: 3, a: 'Q4 Sales', b: 29, c: 55, d: 81 },
  { id: 4, a: 'Total',    b: '',  c: '',  d: '' },
];

// Formulas per row for E column
const E_FORMULAS = [
  '=SUM(B2:D2)',
  '=SUM(B3:D3)',
  '=SUM(B4:D4)',
  '=SUM(B5:D5)',
  '',
];
const E_RESULTS = ['142', '142', '153', '165', ''];

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

type Selection = {
  startRow: number; startCol: number;
  endRow: number;   endCol: number;
} | null;

interface GridState {
  visible: boolean;
  fading: boolean;
  selection: Selection;
  // activeCell drives formula bar display
  activeCell: { row: number; col: number } | null;
  // What shows in the formula bar input area
  formulaBarText: string;
  // True while typewriter is running (shows cursor)
  formulaBarTyping: boolean;
  // Soft highlight the formula bar strip
  formulaBarHighlight: boolean;
  eValues: (string | null)[];
  fillHandleRow: number | null;
  sortActive: boolean;
  sortedOrder: number[];
}

const INITIAL: GridState = {
  visible: false,
  fading: false,
  selection: null,
  activeCell: null,
  formulaBarText: '',
  formulaBarTyping: false,
  formulaBarHighlight: false,
  eValues: [null, null, null, null, null],
  fillHandleRow: null,
  sortActive: false,
  sortedOrder: [0, 1, 2, 3, 4],
};

/* ──────────────────────────────────────────────
   Component
   ────────────────────────────────────────────── */

export default function AnimatedGridDemo() {
  const [s, setS] = useState<GridState>(INITIAL);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const patch = useCallback((p: Partial<GridState>) => {
    setS(prev => ({ ...prev, ...p }));
  }, []);

  const runAnimation = useCallback(() => {
    clearAll();
    setS(INITIAL);

    const seq: Array<[number, () => void]> = [];
    const at = (ms: number, fn: () => void) => seq.push([ms, fn]);

    // ── Phase 0: fade in (0.4s)
    at(400, () => patch({ visible: true }));

    // ── Phase 1: selection sweep A2→D2→D5 (0.8s – 2.5s)
    at(800,  () => patch({ selection: { startRow: 1, startCol: 1, endRow: 1, endCol: 1 } }));
    at(1050, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 1, endCol: 2 } }));
    at(1300, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 1, endCol: 3 } }));
    at(1550, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 1, endCol: 4 } }));
    at(1850, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 2, endCol: 4 } }));
    at(2150, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 3, endCol: 4 } }));
    at(2450, () => patch({ selection: { startRow: 1, startCol: 1, endRow: 4, endCol: 4 } }));

    // ── Phase 2: click E2, light up formula bar, typewriter (3.8s – 6.2s)
    at(3800, () => patch({
      selection:  { startRow: 1, startCol: 5, endRow: 1, endCol: 5 },
      activeCell: { row: 1, col: 5 },
      formulaBarTyping: true,
      formulaBarHighlight: true,
      formulaBarText: '',
    }));

    const FORMULA = E_FORMULAS[0]; // =SUM(B2:D2)
    for (let i = 1; i <= FORMULA.length; i++) {
      const chars = i;
      at(3800 + 280 + chars * 80, () => {
        setS(prev => ({ ...prev, formulaBarText: FORMULA.slice(0, chars) }));
      });
    }
    const typeDone = 3800 + 280 + FORMULA.length * 80;

    // Enter pressed - formula bar stays with full formula, result pops in cell
    at(typeDone + 300, () => patch({
      formulaBarTyping: false,   // cursor gone, formula stays
      formulaBarText: FORMULA,   // keep formula visible in bar
      eValues: [E_RESULTS[0], null, null, null, null],
      fillHandleRow: 1,
      selection: { startRow: 1, startCol: 5, endRow: 1, endCol: 5 },
    }));

    // ── Phase 3: fill handle - select & fill E3, E4, E5 (typeDone+1.1s – +3s)
    // As fill moves down, formula bar updates to show adapted formula
    at(typeDone + 1100, () => {
      setS(prev => {
        const ev = [...prev.eValues]; ev[1] = E_RESULTS[1];
        return {
          ...prev, eValues: ev, fillHandleRow: 2,
          selection: { startRow: 1, startCol: 5, endRow: 2, endCol: 5 },
          activeCell: { row: 2, col: 5 },
          formulaBarText: E_FORMULAS[1],
        };
      });
    });
    at(typeDone + 1700, () => {
      setS(prev => {
        const ev = [...prev.eValues]; ev[2] = E_RESULTS[2];
        return {
          ...prev, eValues: ev, fillHandleRow: 3,
          selection: { startRow: 1, startCol: 5, endRow: 3, endCol: 5 },
          activeCell: { row: 3, col: 5 },
          formulaBarText: E_FORMULAS[2],
        };
      });
    });
    at(typeDone + 2300, () => {
      setS(prev => {
        const ev = [...prev.eValues]; ev[3] = E_RESULTS[3];
        return {
          ...prev, eValues: ev, fillHandleRow: 4,
          selection: { startRow: 1, startCol: 5, endRow: 4, endCol: 5 },
          activeCell: { row: 4, col: 5 },
          formulaBarText: E_FORMULAS[3],
        };
      });
    });

    // ── Phase 4: sort by E desc (typeDone+3.3s – +5.5s)
    const sortStart = typeDone + 3300;
    at(sortStart, () => patch({
      sortActive: true,
      selection: null,
      fillHandleRow: null,
      activeCell: null,
      formulaBarText: '',
      formulaBarHighlight: false,
    }));
    at(sortStart + 700,  () => patch({ sortedOrder: [3, 2, 0, 1, 4] }));
    at(sortStart + 1500, () => patch({ sortActive: false }));

    // ── Phase 5: pause → fade → restart
    at(sortStart + 3800, () => patch({ fading: true, visible: false }));
    at(sortStart + 5300, () => runAnimation());

    seq.forEach(([ms, fn]) => {
      timers.current.push(setTimeout(fn, ms));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    runAnimation();
    return () => clearAll();
  }, [runAnimation]);

  const {
    visible, fading, selection, activeCell,
    formulaBarText, formulaBarTyping, formulaBarHighlight,
    eValues, fillHandleRow, sortActive, sortedOrder,
  } = s;

  const isSel = (row: number, col: number) => {
    if (!selection) return false;
    return row >= selection.startRow && row <= selection.endRow
      && col >= selection.startCol && col <= selection.endCol;
  };

  const isActive = (row: number, col: number) =>
    !!activeCell && activeCell.row === row && activeCell.col === col;

  const displayRows  = sortedOrder.map(i => ROWS[i]);
  const displayEVals = sortedOrder.map(i => eValues[i]);

  // Cell ref label for the name box
  const cellLabel = activeCell
    ? `${COLUMNS[activeCell.col]}${activeCell.row + 1}`
    : selection
      ? `${COLUMNS[selection.startCol]}${selection.startRow + 1}`
      : 'A1';

  return (
    <div
      className={[
        styles.wrapper,
        visible  ? styles.wrapperVisible : '',
        fading   ? styles.wrapperFading  : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      {/* ── Formula bar ── */}
      <div className={[
        styles.formulaBar,
        formulaBarHighlight ? styles.formulaBarActive : '',
      ].filter(Boolean).join(' ')}>

        {/* Name box */}
        <div className={[
          styles.formulaNameBox,
          formulaBarHighlight ? styles.formulaNameBoxActive : '',
        ].filter(Boolean).join(' ')}>
          {cellLabel}
        </div>

        {/* fx badge */}
        <div className={styles.formulaFx}>
          <span className={styles.formulaFxIcon}>fx</span>
        </div>

        {/* Input area */}
        <div className={styles.formulaInput}>
          {formulaBarText ? (
            <span className={styles.formulaInputText}>
              {formulaBarText}
              {formulaBarTyping && <span className={styles.cursor} />}
            </span>
          ) : (
            <span className={styles.formulaInputPlaceholder}>
              {formulaBarHighlight ? '' : 'Click a cell to edit'}
            </span>
          )}
        </div>

        {/* Engine badge - always shown, glows when formula bar is active */}
        <div className={[
          styles.formulaEngineBadge,
          formulaBarHighlight ? styles.formulaEngineBadgeActive : '',
        ].filter(Boolean).join(' ')}>
          <span className={styles.formulaEngineDot} />
          93 functions
        </div>
      </div>

      {/* ── Grid ── */}
      <div className={styles.grid}>

        {/* Column headers */}
        <div className={styles.headerRow}>
          {COLUMNS.map((col, ci) => (
            <div
              key={ci}
              className={[
                styles.headerCell,
                ci === 0 ? styles.rowNumHeader : '',
                sortActive && ci === 5 ? styles.headerSortActive : '',
              ].filter(Boolean).join(' ')}
            >
              {col}
              {ci === 5 && sortActive && <span className={styles.sortIcon}>↓</span>}
            </div>
          ))}
        </div>

        {/* Data rows */}
        {displayRows.map((row, ri) => {
          const dri = ri + 1;
          const eVal = displayEVals[ri];
          const isTotal = row.id === 4;
          const showHandle = fillHandleRow === dri && !isTotal;

          return (
            <div
              key={`${row.id}-${ri}`}
              className={[
                styles.dataRow,
                sortActive ? styles.dataRowSorting : '',
              ].filter(Boolean).join(' ')}
            >
              <div className={styles.rowNum}>{dri}</div>

              <div className={[
                styles.cell, styles.cellA,
                isSel(dri, 1) ? styles.cellSel : '',
                isActive(dri, 1) ? styles.cellActive : '',
                isTotal ? styles.cellTotal : '',
              ].filter(Boolean).join(' ')}>
                {row.a}
              </div>

              <div className={[
                styles.cell, styles.cellNum,
                isSel(dri, 2) ? styles.cellSel : '',
              ].filter(Boolean).join(' ')}>
                {row.b}
              </div>

              <div className={[
                styles.cell, styles.cellNum,
                isSel(dri, 3) ? styles.cellSel : '',
              ].filter(Boolean).join(' ')}>
                {row.c}
              </div>

              <div className={[
                styles.cell, styles.cellNum,
                isSel(dri, 4) ? styles.cellSel : '',
              ].filter(Boolean).join(' ')}>
                {row.d}
              </div>

              <div className={[
                styles.cell, styles.cellNum, styles.cellE,
                isSel(dri, 5) ? styles.cellSel : '',
                isActive(dri, 5) ? styles.cellActive : '',
                eVal ? styles.cellFormula : '',
              ].filter(Boolean).join(' ')}>
                {eVal
                  ? <span className={styles.formulaValue}>{eVal}</span>
                  : isActive(dri, 5) && formulaBarTyping
                    ? <span className={styles.formulaPreview}>{formulaBarText}</span>
                    : null}
                {showHandle && <div className={styles.fillHandle} />}
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.glow} />
    </div>
  );
}
