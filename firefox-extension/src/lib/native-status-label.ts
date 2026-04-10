export function formatNativeHostStatusLabel(input: {
  available: boolean;
  version?: string | null | undefined;
}): string {
  if (!input.available) {
    return 'Host nativo no disponible';
  }

  const version = input.version?.trim();
  return version ? `Host nativo v${version}` : 'Host nativo disponible';
}
