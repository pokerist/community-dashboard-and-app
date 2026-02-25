import { PrismaClient } from '@prisma/client';
import { BaseQueryDto } from '../dto/base-query.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginationOptions {
  searchFields?: string[];
  additionalFilters?: Record<string, any>;
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
}

/**
 * Generic pagination utility for Prisma models
 * @param model - Prisma model delegate (e.g., prisma.user)
 * @param query - Query DTO extending BaseQueryDto
 * @param options - Additional options for search fields, filters, includes
 * @returns Paginated result with data and meta
 */
export async function paginate<T extends Record<string, any>>(
  model: any,
  query: BaseQueryDto,
  options: PaginationOptions = {},
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 10, sortBy, sortOrder = 'desc', search } = query;
  const {
    searchFields = [],
    additionalFilters = {},
    where: baseWhere,
    include,
    select,
  } = options;

  const derivedWhere = buildWhereClause(additionalFilters, searchFields, search);
  const hasBaseWhere =
    !!baseWhere && typeof baseWhere === 'object' && Object.keys(baseWhere).length > 0;
  const hasDerivedWhere =
    !!derivedWhere &&
    typeof derivedWhere === 'object' &&
    Object.keys(derivedWhere).length > 0;

  const where =
    hasBaseWhere && hasDerivedWhere
      ? { AND: [baseWhere, derivedWhere] }
      : hasBaseWhere
        ? baseWhere
        : derivedWhere;

  // Build orderBy
  const orderBy: Record<string, any> = sortBy
    ? { [sortBy]: sortOrder }
    : { createdAt: 'desc' };

  const skip = (page - 1) * limit;

  // Execute queries in parallel
  const [data, total] = await Promise.all([
    model.findMany({
      where,
      ...(include && { include }),
      ...(select && { select }),
      orderBy,
      skip,
      take: limit,
    }),
    model.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

/**
 * Helper function to build where clause from filter object
 * Handles enum fields, date ranges, and foreign keys
 */
export function buildWhereClause(
  filters: Record<string, any>,
  searchFields: string[] = [],
  search?: string,
): Record<string, any> {
  const where: Record<string, any> = { ...filters };

  // Handle date range filters (createdAtFrom, createdAtTo, etc.)
  Object.keys(where).forEach((key) => {
    if (key.endsWith('From') && where[key]) {
      const field = key.replace('From', '');
      const toKey = `${field}To`;
      if (!where[field]) {
        where[field] = {};
      }
      where[field].gte = where[key];
      delete where[key];
    }
    if (key.endsWith('To') && where[key]) {
      const field = key.replace('To', '');
      if (!where[field]) {
        where[field] = {};
      }
      where[field].lte = where[key];
      delete where[key];
    }
  });

  // Add search if provided
  if (search && searchFields.length > 0) {
    where.OR = searchFields.map((field) => ({
      [field]: {
        contains: search,
        mode: 'insensitive' as const,
      },
    }));
  }

  // Remove undefined/null values
  Object.keys(where).forEach((key) => {
    if (where[key] === undefined || where[key] === null || where[key] === '') {
      delete where[key];
    }
  });

  return where;
}
