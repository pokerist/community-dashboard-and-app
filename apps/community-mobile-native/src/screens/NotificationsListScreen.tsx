import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { AuthSession } from '../features/auth/types';
import type { MobileNotificationRow } from '../features/notifications/types';
import { useNotificationRealtime } from '../features/notifications/realtime';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type FilterMode = 'all' | 'unread';

type NotificationsListScreenProps = {
  session: AuthSession;
};

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function notificationVisual(type?: string) {
  const key = String(type ?? '').toUpperCase();
  if (key.includes('PAYMENT') || key.includes('INVOICE')) {
    return {
      icon: 'card-outline' as const,
      iconColor: '#D97706',
      bg: 'rgba(245,158,11,0.10)',
    };
  }
  if (key.includes('SERVICE')) {
    return {
      icon: 'construct-outline' as const,
      iconColor: akColors.primary,
      bg: 'rgba(42,62,53,0.10)',
    };
  }
  if (key.includes('SECURITY') || key.includes('INCIDENT')) {
    return {
      icon: 'shield-checkmark-outline' as const,
      iconColor: '#DC2626',
      bg: 'rgba(239,68,68,0.10)',
    };
  }
  if (key.includes('EVENT') || key.includes('BOOKING')) {
    return {
      icon: 'calendar-outline' as const,
      iconColor: '#059669',
      bg: 'rgba(16,185,129,0.10)',
    };
  }
  return {
    icon: 'notifications-outline' as const,
    iconColor: akColors.textMuted,
    bg: akColors.surfaceMuted,
  };
}

function NotificationRowItem({
  item,
  onMarkRead,
  isMarking,
}: {
  item: MobileNotificationRow;
  onMarkRead: (id: string) => void;
  isMarking: boolean;
}) {
  const visual = notificationVisual(item.type);

  return (
    <View style={[styles.rowCard, !item.isRead && styles.rowCardUnread]}>
      <View style={styles.rowHeader}>
        <View style={[styles.rowIconWrap, { backgroundColor: visual.bg }]}>
          <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.rowSubtitle}>
            {item.type} • {item.status}
          </Text>
        </View>
        <View
          style={[
            styles.readBadge,
            item.isRead ? styles.readBadgeRead : styles.readBadgeUnread,
          ]}
        >
          <Text
            style={[
              styles.readBadgeText,
              item.isRead ? styles.readBadgeTextRead : styles.readBadgeTextUnread,
            ]}
          >
            {item.isRead ? 'Read' : 'Unread'}
          </Text>
        </View>
      </View>

      <Text style={styles.rowMessage}>{item.messageEn || 'No message'}</Text>

      <Text style={styles.rowTime}>{formatDateTime(item.sentAt || item.createdAt)}</Text>

      {!item.isRead ? (
        <Pressable
          style={[styles.markReadButton, isMarking && styles.buttonDisabled]}
          onPress={() => onMarkRead(item.id)}
          disabled={isMarking}
        >
          {isMarking ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={akColors.primary} />
              <Text style={styles.markReadText}>Updating...</Text>
            </View>
          ) : (
            <Text style={styles.markReadText}>Mark as Read</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function NotificationsListScreen({ session }: NotificationsListScreenProps) {
  const insets = useSafeAreaInsets();
  const notifications = useNotificationRealtime();
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredRows = useMemo(() => {
    if (filter === 'all') return notifications.rows;
    return notifications.rows.filter((row) => !row.isRead);
  }, [filter, notifications.rows]);

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={[styles.topCardWrap, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
        <View style={styles.headerBlock}>
          <Text style={styles.screenTitle}>Notifications</Text>
          <Text style={styles.screenSubtitle}>Stay updated with latest news</Text>
        </View>
        <View style={styles.filtersRow}>
          <Pressable
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'all' && styles.filterChipTextActive,
              ]}
            >
              All ({notifications.rows.length})
            </Text>
          </Pressable>
          <Pressable
            style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
            onPress={() => setFilter('unread')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'unread' && styles.filterChipTextActive,
              ]}
            >
              Unread ({notifications.unreadCount})
            </Text>
          </Pressable>
          <Pressable style={styles.refreshChip} onPress={() => void notifications.refreshNow()}>
            <Text style={styles.refreshChipText}>
              {notifications.isRefreshing || notifications.isInitialLoading
                ? 'Refreshing...'
                : 'Refresh'}
            </Text>
          </Pressable>
        </View>
        {notifications.errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{notifications.errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefreshing}
            onRefresh={() => void notifications.refreshNow()}
          />
        }
        ListEmptyComponent={
          notifications.isInitialLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={akColors.primary} />
              <Text style={styles.emptyText}>Loading notifications...</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No notifications found.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <NotificationRowItem
            item={item}
            onMarkRead={(id) => void notifications.markRead(id)}
            isMarking={notifications.markingId === item.id}
          />
        )}
        ListFooterComponent={
          <View style={styles.listFooterHint}>
            <Text style={styles.listFooterHintText}>
              Showing latest {notifications.rows.length} • {notifications.connectionState}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  topCardWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: akColors.bg,
    gap: 10,
  },
  headerBlock: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    ...akShadow.soft,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: akColors.text,
  },
  screenSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: akColors.textMuted,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.surface,
  },
  filterChipActive: {
    backgroundColor: akColors.primary,
    borderColor: akColors.primary,
  },
  filterChipText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  refreshChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.surface,
  },
  refreshChipText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBox: {
    borderWidth: 1,
    borderColor: akColors.dangerBorder,
    backgroundColor: akColors.dangerBg,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    gap: 10,
    flexGrow: 1,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
  },
  rowCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 12,
    gap: 8,
    ...akShadow.soft,
  },
  rowCardUnread: {
    backgroundColor: '#2a3e35' + '07',
    borderColor: '#d7ddd9',
  },
  rowHeader: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowTitleUnread: {
    color: akColors.text,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 3,
    color: akColors.textMuted,
    fontSize: 11,
  },
  readBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  readBadgeUnread: {
    backgroundColor: akColors.goldSoft,
    borderColor: '#e4d4ab',
  },
  readBadgeRead: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  readBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  readBadgeTextUnread: {
    color: '#8A6A24',
  },
  readBadgeTextRead: {
    color: '#166534',
  },
  rowMessage: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  rowTime: {
    color: akColors.textSoft,
    fontSize: 11,
  },
  markReadButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d6c28a',
    backgroundColor: '#fff8e6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  markReadText: {
    color: akColors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  loadMoreButton: {
    marginTop: 8,
    backgroundColor: akColors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  listFooterHint: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  listFooterHintText: {
    fontSize: 12,
    color: akColors.textSoft,
  },
  inlineLoading: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
