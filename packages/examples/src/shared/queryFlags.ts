export interface ExampleFeatureFlags {
  cellReferences: boolean;
  columnGroups: boolean;
  formulas: boolean;
  pinned: boolean;
  premiumInputs: boolean;
  rowSelection: boolean;
  serverSide: boolean;
  xlsx: boolean;
}

export function getExampleFeatureFlags(search: string): ExampleFeatureFlags {
  const params = new URLSearchParams(search);
  return {
    cellReferences: params.has('cellReferences'),
    columnGroups: params.has('columnGroups'),
    formulas: params.has('formulas'),
    pinned: params.has('pinned'),
    premiumInputs: params.has('premiumInputs'),
    rowSelection: params.has('rowSelection'),
    serverSide: params.has('serverSide'),
    xlsx: params.has('xlsx'),
  };
}

export function shouldEnableCellReferences(search: string): boolean {
  return getExampleFeatureFlags(search).cellReferences;
}
