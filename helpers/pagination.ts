/**
 * Cursor-based pagination helper
 * Provides reusable utilities for cursor pagination across the app
 */

export interface PaginationParams {
  limit: number;
  cursor: string | undefined;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    count: number;
  };
}

export interface CursorQueryOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

/**
 * Parse pagination parameters from query string
 * @param query - Express query object (req.query)
 * @param options - Optional configuration for limits
 * @returns Parsed pagination params with sanitized values
 */
export function parsePaginationParams(
  query: { limit?: string | number; cursor?: string },
  options: CursorQueryOptions = {}
): PaginationParams {
  const { defaultLimit = 10, maxLimit = 50 } = options;

  const limit = Math.min(
    Math.max(Number(query.limit) || defaultLimit, 1),
    maxLimit
  );
  const cursor = query.cursor as string | undefined;

  return { limit, cursor };
}

/**
 * Build Prisma cursor query options
 * @param params - Pagination parameters
 * @returns Object with take, skip, and cursor for Prisma findMany
 */
export function buildCursorQuery(params: PaginationParams) {
  const { limit, cursor } = params;

  return {
    take: limit,
    skip: cursor ? 1 : 0, // Skip the cursor item itself
    cursor: cursor ? { id: cursor } : undefined,
  };
}

/**
 * Build pagination response metadata
 * @param items - Array of fetched items
 * @param limit - The limit used in the query
 * @param idField - The field to use as cursor (default: 'id')
 * @returns Pagination metadata object
 */
export function buildPaginationResponse<T extends { id: string }>(
  items: T[],
  limit: number
): PaginationResult<T>['pagination'] {
  const hasMore = items.length === limit;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  return {
    nextCursor,
    hasMore,
    count: items.length,
  };
}

/**
 * Complete pagination helper - combines parsing, query building, and response
 * Use this for simple paginated queries
 */
export function createPaginatedResponse<T extends { id: string }>(
  items: T[],
  limit: number
): PaginationResult<T> {
  return {
    data: items,
    pagination: buildPaginationResponse(items, limit),
  };
}
