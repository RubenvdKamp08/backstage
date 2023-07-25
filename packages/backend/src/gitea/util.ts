export function parseLastModified(value: string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return new Date(value);
}