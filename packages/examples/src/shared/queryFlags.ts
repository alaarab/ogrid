export function shouldEnableCellReferences(search: string): boolean {
  return new URLSearchParams(search).has('cellReferences');
}
