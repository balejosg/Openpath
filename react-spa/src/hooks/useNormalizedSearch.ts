import { useMemo } from 'react';
import { normalizeSearchTerm, type NormalizedSearchOptions } from '../lib/search';

const DEFAULT_OPTIONS: Required<NormalizedSearchOptions> = {
  collapseWhitespace: true,
  stripDiacritics: true,
};

export { normalizeSearchTerm, type NormalizedSearchOptions };

export function useNormalizedSearch(
  rawQuery: string,
  options: NormalizedSearchOptions = DEFAULT_OPTIONS
): string {
  return useMemo(() => normalizeSearchTerm(rawQuery, options), [rawQuery, options]);
}
