"use client";

import { useEffect, useMemo, useState } from "react";

export const TABLE_PAGE_SIZE = 10;

export function useClientPagination<T>(
  items: T[],
  options?: { pageSize?: number; resetKey?: string | number }
) {
  const pageSize = options?.pageSize ?? TABLE_PAGE_SIZE;
  const resetKey = options?.resetKey;
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const showPagination = total > pageSize;

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageItems,
    pageSize,
    total,
    totalPages,
    showPagination,
  };
}
