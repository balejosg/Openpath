import { useCallback, useEffect, useMemo, useState } from 'react';

import type { DomainGroup } from '../lib/rule-groups';

interface UseGroupedRulesSelectionOptions {
  domainGroups: DomainGroup[];
  resetKeys: readonly unknown[];
}

export interface UseGroupedRulesSelectionResult {
  clearSelection: () => void;
  deselectGroup: (rootDomain: string) => void;
  hasSelection: boolean;
  isAllSelected: boolean;
  selectedIds: Set<string>;
  selectGroup: (rootDomain: string) => void;
  toggleSelectAll: () => void;
  toggleSelection: (id: string) => void;
}

export function useGroupedRulesSelection({
  domainGroups,
  resetKeys,
}: UseGroupedRulesSelectionOptions): UseGroupedRulesSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allRulesInView = useMemo(
    () => domainGroups.flatMap((group) => group.rules),
    [domainGroups]
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, resetKeys);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allIds = allRulesInView.map((rule) => rule.id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [allRulesInView, selectedIds.size]);

  const selectGroup = useCallback(
    (rootDomain: string) => {
      const group = domainGroups.find((entry) => entry.root === rootDomain);
      if (!group) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const rule of group.rules) {
          next.add(rule.id);
        }
        return next;
      });
    },
    [domainGroups]
  );

  const deselectGroup = useCallback(
    (rootDomain: string) => {
      const group = domainGroups.find((entry) => entry.root === rootDomain);
      if (!group) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const rule of group.rules) {
          next.delete(rule.id);
        }
        return next;
      });
    },
    [domainGroups]
  );

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    clearSelection,
    deselectGroup,
    hasSelection: selectedIds.size > 0,
    isAllSelected: allRulesInView.length > 0 && selectedIds.size === allRulesInView.length,
    selectedIds,
    selectGroup,
    toggleSelectAll,
    toggleSelection,
  };
}
