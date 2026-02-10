export type SearchOptions = {
  ourNumber: string;
  noteToSelfAliases: Array<string>;
  excludeBlocked: boolean;
};

export type AdvancedSearchOptions = {
  query: string;
  from?: string;
  before: number;
  after: number;
};
