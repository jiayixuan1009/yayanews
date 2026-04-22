'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useIntersectionObserver(options: IntersectionObserverInit = {}) {
  const [isIntersecting, setIsIntersecting] = useState(true); // default true so SSR / skeleton matches first paint
  const [node, setNode] = useState<Element | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, {
      rootMargin: '100px',
      ...optionsRef.current,
    });

    observer.observe(node);

    return () => {
      observer.unobserve(node);
      observer.disconnect();
    };
  }, [node]);

  const setRef = useCallback((el: Element | null) => {
    setNode(el);
  }, []);

  return [setRef, isIntersecting] as const;
}
