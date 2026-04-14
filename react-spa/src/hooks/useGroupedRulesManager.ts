import { useState, useCallback, useEffect, useRef } from 'react';
import {
  addRuleWithDetection,
  bulkCreateRulesAction,
  bulkDeleteRulesWithUndoAction,
  deleteRuleWithUndoAction,
  updateRuleAction,
} from '../lib/rules-actions';
import type { Rule, RuleType } from '../lib/rules';
import type { DomainGroup } from '../lib/rule-groups';
import { useGroupedRulesData } from './useGroupedRulesData';
import { useGroupedRulesSelection } from './useGroupedRulesSelection';

export type FilterType = 'all' | 'allowed' | 'blocked';
export type { DomainGroup } from '../lib/rule-groups';

interface UseGroupedRulesManagerOptions {
  groupId: string;
  onToast: (message: string, type: 'success' | 'error', undoAction?: () => void) => void;
}

export interface UseGroupedRulesManagerReturn {
  // Data
  domainGroups: DomainGroup[];
  totalGroups: number;
  totalRules: number;
  loading: boolean;
  error: string | null;

  // Pagination (by domain groups, not individual rules)
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  hasMore: boolean;

  // Filtering
  filter: FilterType;
  setFilter: (filter: FilterType) => void;
  search: string;
  setSearch: (search: string) => void;

  // Counts
  counts: { all: number; allowed: number; blocked: number };

  // Selection
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  selectGroup: (rootDomain: string) => void;
  deselectGroup: (rootDomain: string) => void;
  clearSelection: () => void;
  isAllSelected: boolean;
  hasSelection: boolean;

  // Actions
  addRule: (value: string) => Promise<boolean>;
  deleteRule: (rule: Rule) => Promise<void>;
  bulkDeleteRules: () => Promise<void>;
  bulkCreateRules: (
    values: string[],
    type: RuleType
  ) => Promise<{ created: number; total: number }>;
  updateRule: (id: string, data: { value?: string; comment?: string | null }) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing rules grouped by root domain with pagination on groups.
 * This ensures domain groups are never split across pages.
 */
export function useGroupedRulesManager({
  groupId,
  onToast,
}: UseGroupedRulesManagerOptions): UseGroupedRulesManagerReturn {
  // Data state
  // Pagination state
  const [page, setPage] = useState(1);

  // Filter state
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  // Counts for tabs
  const { counts, domainGroups, error, loading, refetch, totalGroups, totalPages, totalRules } =
    useGroupedRulesData({
      filter,
      groupId,
      page,
      search,
    });

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    clearSelection,
    deselectGroup,
    hasSelection,
    isAllSelected,
    selectedIds,
    selectGroup,
    toggleSelectAll,
    toggleSelection,
  } = useGroupedRulesSelection({
    domainGroups,
    resetKeys: [page, filter, search],
  });

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setPage(1); // Reset to first page on search
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [filter]);

  // Add rule
  const addRule = useCallback(
    async (value: string): Promise<boolean> => {
      return addRuleWithDetection(value, {
        groupId,
        onToast,
        fetchRules: refetch,
        fetchCounts: refetch,
      });
    },
    [groupId, onToast, refetch]
  );

  // Delete rule with undo
  const deleteRule = useCallback(
    async (rule: Rule): Promise<void> => {
      await deleteRuleWithUndoAction(rule, { onToast, fetchRules: refetch, fetchCounts: refetch });
    },
    [onToast, refetch]
  );

  // Update rule
  const updateRule = useCallback(
    async (id: string, data: { value?: string; comment?: string | null }): Promise<boolean> => {
      return updateRuleAction(id, data, { groupId, onToast, fetchRules: refetch });
    },
    [groupId, onToast, refetch]
  );

  // Bulk delete rules with undo
  const bulkDeleteRules = useCallback(async (): Promise<void> => {
    if (selectedIds.size === 0) return;

    const idsToDelete = Array.from(selectedIds);

    await bulkDeleteRulesWithUndoAction({
      ids: idsToDelete,
      clearSelection,
      onToast,
      fetchRules: refetch,
      fetchCounts: refetch,
    });
  }, [selectedIds, clearSelection, onToast, refetch]);

  // Bulk create rules
  const bulkCreateRules = useCallback(
    async (values: string[], type: RuleType): Promise<{ created: number; total: number }> => {
      if (values.length === 0) return { created: 0, total: 0 };

      return bulkCreateRulesAction(values, type, {
        groupId,
        onToast,
        fetchRules: refetch,
        fetchCounts: refetch,
      });
    },
    [groupId, onToast, refetch]
  );

  const hasMore = page < totalPages;

  return {
    // Data
    domainGroups,
    totalGroups,
    totalRules,
    loading,
    error,

    // Pagination
    page,
    setPage,
    totalPages,
    hasMore,

    // Filtering
    filter,
    setFilter,
    search,
    setSearch,

    // Counts
    counts,

    // Selection
    selectedIds,
    toggleSelection,
    toggleSelectAll,
    selectGroup,
    deselectGroup,
    clearSelection,
    isAllSelected,
    hasSelection,

    // Actions
    addRule,
    deleteRule,
    bulkDeleteRules,
    bulkCreateRules,
    updateRule,
    refetch,
  };
}

export default useGroupedRulesManager;
