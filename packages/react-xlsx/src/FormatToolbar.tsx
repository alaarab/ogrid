import { lazy, Suspense } from 'react';
import type { FormatToolbarProps } from './FormatToolbarContent';

export type { FormatToolbarProps } from './FormatToolbarContent';
const Toolbar = lazy(() => import('./FormatToolbarContent').then(m => ({ default: m.FormatToolbar })));

/** Load the formatting controls only when a toolbar is rendered. */
export function FormatToolbar(props: FormatToolbarProps) {
  return <Suspense fallback={null}><Toolbar {...props} /></Suspense>;
}
