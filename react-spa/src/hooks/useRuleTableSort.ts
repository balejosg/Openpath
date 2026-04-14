import { useCallback, useMemo, useState } from 'react';

import type { Rule } from '../lib/rules';

export type SortField = 'value' | 'type' | 'createdAt';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface UseRuleTableSortResult {
  handleSort: (field: SortField) => void;
  sortConfig: SortConfig | null;
  sortedRules: Rule[];
}

export function useRuleTableSort(rules: Rule[]): UseRuleTableSortResult {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((current) => {
      if (current?.field === field) {
        if (current.direction === 'asc') {
          return { field, direction: 'desc' };
        }
        return null;
      }
      return { field, direction: 'asc' };
    });
  }, []);

  const sortedRules = useMemo(() => {
    if (!sortConfig) return rules;

    return [...rules].sort((left, right) => {
      const { direction, field } = sortConfig;
      let comparison = 0;

      switch (field) {
        case 'value':
          comparison = left.value.localeCompare(right.value);
          break;
        case 'type':
          comparison = left.type.localeCompare(right.type);
          break;
        case 'createdAt':
          comparison = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          break;
      }

      return direction === 'desc' ? -comparison : comparison;
    });
  }, [rules, sortConfig]);

  return { handleSort, sortConfig, sortedRules };
}
