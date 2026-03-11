export interface ExampleFeatureFlags {
  cellReferences: boolean;
  formulas: boolean;
  premiumInputs: boolean;
  rowSelection: boolean;
  serverSide: boolean;
}

export function getExampleFeatureFlags(search: string): ExampleFeatureFlags {
  const params = new URLSearchParams(search);
  return {
    cellReferences: params.has('cellReferences'),
    formulas: params.has('formulas'),
    premiumInputs: params.has('premiumInputs'),
    rowSelection: params.has('rowSelection'),
    serverSide: params.has('serverSide'),
  };
}

export function shouldEnableCellReferences(search: string): boolean {
  return getExampleFeatureFlags(search).cellReferences;
}
