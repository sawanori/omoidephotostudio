'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

type LoadMoreAction = (
  offset: number
) => Promise<readonly [JSX.Element[], number | null]>;

interface LoadMoreProps {
  children: React.ReactNode;
  initialOffset: number;
  loadMoreAction: LoadMoreAction;
}

export function LoadMore({
  children,
  initialOffset,
  loadMoreAction,
}: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [loadMoreNodes, setLoadMoreNodes] = useState<JSX.Element[]>([]);
  const [loading, setLoading] = useState(false);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const currentOffsetRef = useRef<number | undefined>(initialOffset);

  const loadMore = useCallback(
    async (abortController?: AbortController) => {
      if (loading || allDataLoaded) return;
      setLoading(true);

      try {
        if (currentOffsetRef.current === undefined) return;

        const [nodes, nextOffset] = await loadMoreAction(currentOffsetRef.current);
        
        if (abortController?.signal.aborted) return;

        if (nodes.length < 12) {
          setAllDataLoaded(true);
        }

        setLoadMoreNodes(prev => [...prev, ...nodes]);
        currentOffsetRef.current = nextOffset ?? undefined;
      } catch (error) {
        console.error('Error loading more images:', error);
      } finally {
        setLoading(false);
      }
    },
    [loadMoreAction, loading, allDataLoaded]
  );

  useEffect(() => {
    const abortController = new AbortController();
    const element = ref.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadMore(abortController);
        }
      },
      { threshold: 0.1 }
    );

    if (element) {
      observer.observe(element);
    }

    return () => {
      abortController.abort();
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [loadMore]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {children}
        {loadMoreNodes}
      </div>
      {!allDataLoaded && (
        <div ref={ref} className="w-full flex justify-center items-center py-8">
          {loading && <Loader2 className="h-8 w-8 animate-spin" />}
        </div>
      )}
    </>
  );
}