import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';

import { createTestQueryClient, renderHookWithQueryClient, renderWithQueryClient } from '../query';

function QueryClientProbe() {
  useQueryClient();
  return <div>ready</div>;
}

describe('query test utils', () => {
  it('creates query clients with deterministic test defaults', () => {
    const queryClient = createTestQueryClient();
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.retry).toBe(false);
    expect(defaults.queries?.gcTime).toBe(0);
    expect(defaults.mutations?.retry).toBe(false);
    expect(defaults.mutations?.gcTime).toBe(0);
  });

  it('renders components with a QueryClientProvider', () => {
    const { queryClient } = renderWithQueryClient(<QueryClientProbe />);

    expect(queryClient).toBeDefined();
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('renders hooks with a QueryClientProvider', () => {
    const { queryClient, result } = renderHookWithQueryClient(() => useQueryClient());

    expect(result.current).toBe(queryClient);
  });
});
