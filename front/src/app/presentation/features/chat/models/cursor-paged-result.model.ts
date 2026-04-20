export interface CursorPagedResult<T> {
  items: T[];
  nextCursor: number | null;
  hasMore: boolean;
}
