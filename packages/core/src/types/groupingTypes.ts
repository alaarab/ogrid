export interface IRowGroup<T> {
  groupKey: string;
  groupValue: unknown;
  columnId: string;
  displayText: string;
  items: T[];
  itemCount: number;
  subGroups?: IRowGroup<T>[];
  depth: number;
}

export interface IRowGroupingConfig {
  groupBy: string[];
  expandedGroups: Set<string>;
}

export type RowGroupingDisplayRow<T> =
  | T
  | { __ogridGroupHeader: true; group: IRowGroup<T> };
