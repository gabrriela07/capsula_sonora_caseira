import { useCallback, useEffect, useRef, useState } from 'react';
import { analytics } from '../lib/duckdb';
import type { DashboardData, Filters, Granularity } from '../types';

export function useDashboardData(filters: Filters, granularity: Granularity) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const runId = useRef(0);

  const load = useCallback(async () => {
    const id = ++runId.current;
    setLoading(true);
    setError('');
    try {
      const result = await analytics.dashboard(filters, granularity);
      if (id === runId.current) setData(result);
    } catch (reason) {
      if (id === runId.current) setError(reason instanceof Error ? reason.message : 'Erro inesperado ao consultar os dados.');
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, [filters, granularity]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, retry: load };
}
