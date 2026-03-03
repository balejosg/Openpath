export interface SanitizeSlugOptions {
  /** Maximum length of the resulting slug (default: 100). */
  maxLength?: number;
  /** Whether to allow underscores in the slug (default: true). */
  allowUnderscore?: boolean;
}

/**
 * Sanitize a human input into a URL-safe slug.
 *
 * - lowercases
 * - trims
 * - strips diacritics (NFKD)
 * - replaces runs of invalid characters with '-'
 * - collapses repeated '-'
 * - trims leading/trailing '-'
 */
export function sanitizeSlug(input: string, options: SanitizeSlugOptions = {}): string {
  const maxLength = options.maxLength ?? 100;
  const allowUnderscore = options.allowUnderscore ?? true;

  const trimmed = input.trim();
  if (!trimmed) return '';

  const withoutDiacritics = trimmed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const lowered = withoutDiacritics.toLowerCase();

  const invalidChars = allowUnderscore ? /[^a-z0-9_-]+/g : /[^a-z0-9-]+/g;

  let slug = lowered
    .replace(invalidChars, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (maxLength > 0 && slug.length > maxLength) {
    slug = slug.slice(0, maxLength).replace(/-+$/g, '');
  }

  return slug;
}
