import { useCallback, useEffect, useMemo, useState } from 'react';
import { extractApiErrorMessage } from '../../lib/http';
import { listMyNotifications, markNotificationAsRead } from './service';
import type { MobileNotificationRow } from './types';

type UseNotificationsOptions = {
  accessToken: string;
  pageSize?: number;
  autoLoad?: boolean;
};

export function useNotifications({
  accessToken,
  pageSize = 20,
  autoLoad = true,
}: UseNotificationsOptions) {
  const [rows, setRows] = useState<MobileNotificationRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const loadPage = useCallback(
    async (targetPage: number, mode: 'replace' | 'append' = 'replace') => {
      if (mode === 'append') {
        setIsLoadingMore(true);
      } else if (rows.length > 0) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const result = await listMyNotifications(accessToken, {
          page: targetPage,
          limit: pageSize,
        });

        setRows((prev) =>
          mode === 'append' ? [...prev, ...result.data] : result.data,
        );
        setPage(result.meta.page);
        setTotalPages(result.meta.totalPages);
        setTotal(result.meta.total);
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [accessToken, pageSize, rows.length],
  );

  useEffect(() => {
    if (!autoLoad) return;
    void loadPage(1, 'replace');
  }, [autoLoad, loadPage]);

  const refresh = useCallback(async () => {
    await loadPage(1, 'replace');
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (isLoading || isRefreshing || isLoadingMore) return;
    if (page >= totalPages) return;
    await loadPage(page + 1, 'append');
  }, [isLoading, isRefreshing, isLoadingMore, page, totalPages, loadPage]);

  const markRead = useCallback(
    async (notificationId: string) => {
      setMarkingId(notificationId);
      try {
        const ok = await markNotificationAsRead(accessToken, notificationId);
        if (!ok) {
          throw new Error('Notification was not found or not accessible');
        }
        setRows((prev) =>
          prev.map((row) =>
            row.id === notificationId
              ? {
                  ...row,
                  isRead: true,
                  logs: row.logs.map((log) =>
                    String(log.channel).toUpperCase() === 'IN_APP'
                      ? { ...log, status: 'READ' }
                      : log,
                  ),
                }
              : row,
          ),
        );
      } catch (error) {
        setErrorMessage(extractApiErrorMessage(error));
      } finally {
        setMarkingId(null);
      }
    },
    [accessToken],
  );

  const unreadCount = useMemo(
    () => rows.filter((row) => !row.isRead).length,
    [rows],
  );

  return {
    rows,
    total,
    page,
    totalPages,
    unreadCount,
    isLoading,
    isRefreshing,
    isLoadingMore,
    errorMessage,
    markingId,
    refresh,
    loadMore,
    markRead,
  };
}
