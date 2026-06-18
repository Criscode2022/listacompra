export function matchesTextFilter(name: string, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return name.toLowerCase().includes(normalizedQuery);
}
