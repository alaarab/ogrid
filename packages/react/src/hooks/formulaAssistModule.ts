/**
 * Lazy loader for the formula editing help module (function metadata,
 * autocomplete, argument hints). The function descriptions are a sizable
 * table that only formula grids use, so they load on demand: when a grid with
 * formula help mounts (preload) or when an editor first needs them.
 */
import { useEffect, useState } from 'react';

export type FormulaAssistModule = typeof import('@alaarab/ogrid-core/formula/assist');

let loaded: FormulaAssistModule | null = null;
let pending: Promise<FormulaAssistModule> | null = null;

/** Start loading the formula help module (idempotent). */
export function loadFormulaAssistModule(): Promise<FormulaAssistModule> {
  if (loaded) return Promise.resolve(loaded);
  if (!pending) {
    pending = import('@alaarab/ogrid-core/formula/assist').then(
      (mod) => {
        loaded = mod;
        return mod;
      },
      (err: unknown) => {
        // Allow a retry on the next request (e.g. a transient chunk load failure).
        pending = null;
        throw err;
      },
    );
  }
  return pending;
}

/** The formula help module once loaded; null until then. Loads only while `enabled`. */
export function useFormulaAssistModule(enabled: boolean): FormulaAssistModule | null {
  const [mod, setMod] = useState<FormulaAssistModule | null>(loaded);
  useEffect(() => {
    if (!enabled || mod) return;
    if (loaded) {
      setMod(loaded);
      return;
    }
    let live = true;
    loadFormulaAssistModule().then(
      (m) => {
        if (live) setMod(m);
      },
      () => {
        // Formula help stays off; editing itself is unaffected.
      },
    );
    return () => {
      live = false;
    };
  }, [enabled, mod]);
  return mod ?? loaded;
}
