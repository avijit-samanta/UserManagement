// Postgres error code 22P02 = "invalid_text_representation" — thrown when a
// string that isn't a valid UUID is compared against a uuid column (e.g.
// .eq('id', someArbitraryString)). The old JSON-file repositories just
// returned undefined for any id that didn't match, via a JS array .find();
// callers (routes, mainly) rely on that — an unrecognized id is a 404, not
// a 500. This lets lookups-by-uuid preserve that behavior instead of
// bubbling a Postgres syntax error up as an unhandled 500.
export function isInvalidUuidError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === '22P02';
}
