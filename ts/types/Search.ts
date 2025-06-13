export type SearchOptions = {
  ourNumber: string;
  noteToSelf: Array<string>;
  savedMessages: string;
  excludeBlocked: boolean;
};

export type AdvancedSearchOptions = {
  query: string;
  from?: string;
  before: number;
  after: number;
};
