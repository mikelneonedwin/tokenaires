"use client";

import { keepPreviousData, queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getBoard, getStats, type BoardParams } from "@/lib/api/boards";
import { queryKeys } from "@/lib/query-keys";

export function boardQueryOptions(params: BoardParams) {
  return queryOptions({
    queryKey: queryKeys.board(params),
    queryFn: () => getBoard(params),
    placeholderData: keepPreviousData,
  });
}

export function useBoard(params: BoardParams) {
  const queryClient = useQueryClient();
  const query = useQuery(boardQueryOptions(params));
  const { period, source, page, q } = params;
  const pages = query.data ? Math.max(1, Math.ceil(query.data.totalEntries / query.data.pageSize)) : 0;

  useEffect(() => {
    if (pages === 0) return;
    for (const near of [page - 1, page + 1]) {
      if (near >= 1 && near <= pages) void queryClient.prefetchQuery(boardQueryOptions({ period, source, q, page: near }));
    }
  }, [period, source, q, page, pages, queryClient]);

  return query;
}

export function useStats() {
  return useQuery({ queryKey: queryKeys.stats(), queryFn: getStats });
}
