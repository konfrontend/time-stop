/** Recent Names worth offering for `value`: those holding its text, minus the one typed in full. */
export function nameSuggestions(names: string[], value: string): string[] {
  const query = value.trim().toLowerCase();
  return names.filter((name) => name.toLowerCase().includes(query) && name !== value);
}
