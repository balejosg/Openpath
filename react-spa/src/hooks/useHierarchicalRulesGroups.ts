import { useCallback, useMemo, useState } from 'react';

import type { DomainGroup } from '../lib/rule-groups';
import { toDomainGroups } from '../lib/rule-groups';
import type { Rule } from '../lib/rules';

export interface UseHierarchicalRulesGroupsResult {
  expandedGroups: Set<string>;
  groups: DomainGroup[];
  toggleGroup: (root: string) => void;
}

export function useHierarchicalRulesGroups(
  rules?: Rule[],
  preGroupedDomains?: DomainGroup[]
): UseHierarchicalRulesGroupsResult {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo(() => {
    if (preGroupedDomains && preGroupedDomains.length > 0) {
      return preGroupedDomains;
    }

    if (!rules || rules.length === 0) {
      return [];
    }

    return toDomainGroups(rules);
  }, [rules, preGroupedDomains]);

  const toggleGroup = useCallback((root: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(root)) {
        next.delete(root);
      } else {
        next.add(root);
      }
      return next;
    });
  }, []);

  return { expandedGroups, groups, toggleGroup };
}
