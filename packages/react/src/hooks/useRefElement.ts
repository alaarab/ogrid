import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

/** Track element replacements while preserving the object-ref API. */
export function useRefElement<T extends HTMLElement>(ref: RefObject<T | null>): T | null {
  const [element, setElement] = useState(ref.current);
  useLayoutEffect(() => {
    if (ref.current !== element) setElement(ref.current);
  });
  return element;
}
