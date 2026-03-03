/**
 * Pure undo/redo stack data structure shared across React, Vue, Angular, and JS.
 * No framework dependencies  -  all state is plain arrays.
 *
 * Usage:
 *   const stack = new UndoRedoStack<MyEvent>(100);
 *   stack.push([event]);        // single event
 *   stack.beginBatch();
 *   stack.push([event1]);
 *   stack.push([event2]);
 *   stack.endBatch();           // event1 + event2 are one undo step
 *   const batch = stack.undo(); // returns the batch to reverse
 *   const batch = stack.redo(); // returns the batch to re-apply
 */

export class UndoRedoStack<T> {
  private history: T[][] = [];
  private redoStack: T[][] = [];
  private batch: T[] | null = null;
  readonly maxDepth: number;

  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
  }

  /** Whether there are undo steps available. */
  get canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Whether there are redo steps available. */
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Number of history entries. */
  get historyLength(): number {
    return this.history.length;
  }

  /** Number of redo entries. */
  get redoLength(): number {
    return this.redoStack.length;
  }

  /** Whether a batch is currently open. */
  get isBatching(): boolean {
    return this.batch !== null;
  }

  /**
   * Record a group of events as a single undoable step.
   * If a batch is open, accumulates into the batch instead.
   * Clears the redo stack on any new entry.
   */
  push(events: T[]): void {
    if (events.length === 0) return;
    if (this.batch !== null) {
      this.batch.push(...events);
    } else {
      this.history.push(events);
      if (this.history.length > this.maxDepth) {
        this.history.splice(0, this.history.length - this.maxDepth);
      }
      // Clear redo stack in-place  -  avoids allocating a new array on every edit
      this.redoStack.length = 0;
    }
  }

  /**
   * Record a single event as a step (shorthand for push([event])).
   * If a batch is open, accumulates into the batch instead.
   */
  record(event: T): void {
    this.push([event]);
  }

  /**
   * Start a batch  -  subsequent record/push calls accumulate into one undo step.
   * Has no effect if a batch is already open.
   */
  beginBatch(): void {
    if (this.batch === null) {
      this.batch = [];
    }
  }

  /**
   * End a batch  -  commits all accumulated events as one undo step.
   * Has no effect if no batch is open or if the batch is empty.
   */
  endBatch(): void {
    const b = this.batch;
    this.batch = null;
    if (!b || b.length === 0) return;
    this.history.push(b);
    if (this.history.length > this.maxDepth) {
      this.history.splice(0, this.history.length - this.maxDepth);
    }
    this.redoStack.length = 0;
  }

  /**
   * Pop the most recent history entry for undo.
   * Returns the batch of events (in original order) to be reversed by the caller,
   * or null if there is nothing to undo.
   *
   * The caller is responsible for applying the events in reverse order.
   */
  undo(): T[] | null {
    const lastBatch = this.history.pop();
    if (!lastBatch) return null;
    this.redoStack.push(lastBatch);
    return lastBatch;
  }

  /**
   * Pop the most recent redo entry.
   * Returns the batch of events (in original order) to be re-applied by the caller,
   * or null if there is nothing to redo.
   */
  redo(): T[] | null {
    const nextBatch = this.redoStack.pop();
    if (!nextBatch) return null;
    this.history.push(nextBatch);
    return nextBatch;
  }

  /**
   * Clear all history and redo state.
   * Does not affect any open batch  -  call endBatch() first if needed.
   */
  clear(): void {
    this.history = [];
    this.redoStack = [];
    // Intentionally leaves this.batch untouched. If a batch is open,
    // subsequent records will still accumulate until endBatch() is called.
    // Callers that want to abort an open batch should call endBatch() first.
  }
}
