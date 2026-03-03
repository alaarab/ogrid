import { useRef, useEffect, useState, RefObject } from 'react';

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
}

interface UseScrollRevealResult<T extends Element> {
  ref: RefObject<T>;
  isRevealed: boolean;
}

export function useScrollReveal<T extends Element = Element>(
  options: UseScrollRevealOptions = {}
): UseScrollRevealResult<T> {
  const { threshold = 0.15, rootMargin = '0px 0px -60px 0px' } = options;
  const ref = useRef<T>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsRevealed(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return { ref, isRevealed };
}
