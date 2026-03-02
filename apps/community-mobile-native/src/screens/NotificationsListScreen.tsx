import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import type { AuthSession } from '../features/auth/types';
import { InAppWebViewerModal } from '../components/mobile/InAppWebViewerModal';
import {
  formatNotificationDateTime,
  formatNotificationRelativeTime,
  isPersonalNotification,
  notificationTypeLabel,
} from '../features/notifications/presentation';
import { useI18n } from '../features/i18n/provider';
import type { MobileNotificationRow } from '../features/notifications/types';
import { useNotificationRealtime } from '../features/notifications/realtime';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type FilterMode = 'all' | 'unread';

type NotificationsListScreenProps = {
  session: AuthSession;
  onOpenInAppRoute?: (payload: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  }) => void;
};

function notificationVisual(
  type: string | undefined,
  palette: ReturnType<typeof getBrandPalette>,
) {
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
      iconColor: palette.primary,
      bg: palette.primarySoft10,
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

function normalizeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function dayBucketLabel(
  dateValue?: string | null,
): 'common.today' | 'common.yesterday' | 'common.earlier' {
  if (!dateValue) return 'common.earlier';
  const ts = new Date(dateValue);
  if (Number.isNaN(ts.getTime())) return 'common.earlier';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (ts >= startOfToday) return 'common.today';
  if (ts >= startOfYesterday) return 'common.yesterday';
  return 'common.earlier';
}

function NotificationRowItem({
  item,
  onMarkRead,
  isMarking,
  onOpen,
  palette,
  language,
}: {
  item: MobileNotificationRow;
  onMarkRead: (id: string) => void;
  isMarking: boolean;
  onOpen: () => void;
  palette: ReturnType<typeof getBrandPalette>;
  language: 'en' | 'ar';
}) {
  const { t } = useI18n();
  const visual = notificationVisual(item.type, palette);
  const safeTitle = item.title?.trim() || t('notifications.notification');
  const safeMessage =
    (language === 'ar'
      ? item.messageAr?.trim() || item.messageEn?.trim()
      : item.messageEn?.trim() || item.messageAr?.trim()) || t('notifications.noDetails');

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.rowCard,
        item.isRead && styles.rowCardRead,
        !item.isRead && [
          styles.rowCardUnread,
          {
            backgroundColor: palette.primarySoft8,
            borderColor: palette.primarySoft22,
            borderLeftColor: palette.primary,
          },
        ],
        pressed && styles.rowCardPressed,
      ]}
    >
      <View style={styles.rowHeader}>
        <View style={[styles.rowIconWrap, { backgroundColor: visual.bg }]}>
          <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, !item.isRead && styles.rowTitleUnread]}>
            {safeTitle}
          </Text>
          <Text style={styles.rowSubtitle}>
            {notificationTypeLabel(item)} • {item.isRead ? t('common.seen') : t('common.new')}
          </Text>
        </View>
        <View
          style={[
            styles.readBadge,
            item.isRead ? styles.readBadgeRead : styles.readBadgeUnread,
            !item.isRead && {
              backgroundColor: palette.accentSoft12,
              borderColor: palette.secondary,
            },
          ]}
        >
          <Text
            style={[
              styles.readBadgeText,
              item.isRead ? styles.readBadgeTextRead : styles.readBadgeTextUnread,
              !item.isRead && { color: palette.primary },
            ]}
          >
            {item.isRead ? t('common.read') : t('common.unread')}
          </Text>
        </View>
      </View>

      <Text style={styles.rowMessage}>{safeMessage}</Text>

      <Text style={styles.rowTime}>
        {formatNotificationRelativeTime(item.sentAt || item.createdAt)} • {formatNotificationDateTime(item.sentAt || item.createdAt)}
      </Text>

      {!item.isRead ? (
        <Pressable
          style={[
            styles.markReadButton,
            { borderColor: palette.secondary, backgroundColor: palette.accentSoft12 },
            isMarking && styles.buttonDisabled,
          ]}
          onPress={(event) => {
            // Prevent row press from firing while marking as read.
            (event as any)?.stopPropagation?.();
            onMarkRead(item.id);
          }}
          disabled={isMarking}
        >
          {isMarking ? (
            <View style={styles.inlineLoading}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={[styles.markReadText, { color: palette.primary }]}>{t('common.updating')}</Text>
            </View>
          ) : (
            <Text style={[styles.markReadText, { color: palette.primary }]}>
              {t('notifications.markAsRead')}
            </Text>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function NotificationsListScreen({ onOpenInAppRoute }: NotificationsListScreenProps) {
  const { t, language } = useI18n();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const insets = useSafeAreaInsets();
  const notifications = useNotificationRealtime();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedNotification, setSelectedNotification] = useState<MobileNotificationRow | null>(null);
  const [webViewerState, setWebViewerState] = useState<{
    visible: boolean;
    url: string | null;
    title: string;
  }>({
    visible: false,
    url: null,
    title: t('notifications.notification'),
  });

  const personalRows = useMemo(
    () => notifications.rows.filter((row) => isPersonalNotification(row)),
    [notifications.rows],
  );
  const unreadPersonalCount = useMemo(
    () => personalRows.filter((row) => !row.isRead).length,
    [personalRows],
  );

  const filteredRows = useMemo(() => {
    if (filter === 'all') return personalRows;
    return personalRows.filter((row) => !row.isRead);
  }, [filter, personalRows]);
  const groupedSections = useMemo(() => {
    const orderedBuckets = ['common.today', 'common.yesterday', 'common.earlier'] as const;
    const bucketMap = new Map<(typeof orderedBuckets)[number], MobileNotificationRow[]>();
    for (const row of filteredRows) {
      const bucket = dayBucketLabel(row.sentAt || row.createdAt);
      const current = bucketMap.get(bucket) ?? [];
      current.push(row);
      bucketMap.set(bucket, current);
    }
    return orderedBuckets
      .map((title) => ({ title, data: bucketMap.get(title) ?? [] }))
      .filter((section) => section.data.length > 0);
  }, [filteredRows]);

  const selectedExternalUrl = useMemo(
    () =>
      normalizeExternalUrl(
        String(
          selectedNotification?.payload?.externalUrl ??
            selectedNotification?.payload?.ctaUrl ??
            selectedNotification?.payload?.linkUrl ??
            '',
        ) || null,
      ),
    [selectedNotification],
  );
  const selectedInternalRoute = useMemo(() => {
    const raw = String(selectedNotification?.payload?.route ?? '').trim();
    return raw || null;
  }, [selectedNotification]);
  const selectedExternalCtaLabel = useMemo(() => {
    const raw = String(
      selectedNotification?.payload?.ctaLabel ?? selectedNotification?.payload?.ctaText ?? '',
    ).trim();
    return raw || t('common.openLink');
  }, [selectedNotification, t]);
  const selectedInAppLabel = useMemo(() => {
    const raw = String(selectedNotification?.payload?.openInAppLabel ?? '').trim();
    return raw || t('common.openInApp');
  }, [selectedNotification, t]);

  const openSelectedLink = async () => {
    if (!selectedExternalUrl) return;
    setWebViewerState({
      visible: true,
      url: selectedExternalUrl,
      title: selectedNotification?.title || t('notifications.notification'),
    });
  };

  const openSelectedInApp = () => {
    if (!selectedNotification || !selectedInternalRoute || !onOpenInAppRoute) return;
    onOpenInAppRoute({
      route: selectedInternalRoute,
      entityType:
        typeof selectedNotification.payload?.entityType === 'string'
          ? selectedNotification.payload.entityType
          : undefined,
      entityId:
        typeof selectedNotification.payload?.entityId === 'string'
          ? selectedNotification.payload.entityId
          : undefined,
      notificationId: selectedNotification.id,
    });
    setSelectedNotification(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={[styles.topCardWrap, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
        <View style={styles.headerBlock}>
          <Text style={styles.screenTitle}>{t('notifications.title')}</Text>
          <Text style={styles.screenSubtitle}>
            {t('notifications.subtitle')}
          </Text>
        </View>
        <View style={styles.filtersRow}>
          <Pressable
            style={[
              styles.filterChip,
              filter === 'all' && [
                styles.filterChipActive,
                { backgroundColor: palette.primary, borderColor: palette.primary },
              ],
            ]}
            onPress={() => setFilter('all')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'all' && styles.filterChipTextActive,
              ]}
              >
              {t('common.all')} ({personalRows.length})
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.filterChip,
              filter === 'unread' && [
                styles.filterChipActive,
                { backgroundColor: palette.primary, borderColor: palette.primary },
              ],
            ]}
            onPress={() => setFilter('unread')}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === 'unread' && styles.filterChipTextActive,
              ]}
              >
              {t('common.unread')} ({unreadPersonalCount})
            </Text>
          </Pressable>
          <Pressable style={styles.refreshChip} onPress={() => void notifications.refreshNow()}>
            <Text style={styles.refreshChipText}>
              {notifications.isRefreshing || notifications.isInitialLoading
                ? t('common.refreshing')
                : t('common.refresh')}
            </Text>
          </Pressable>
        </View>
        {notifications.errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{notifications.errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        extraData={`${filter}:${notifications.markingId ?? ''}:${notifications.unreadCount}:${notifications.rows.length}`}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={notifications.isRefreshing}
            onRefresh={() => void notifications.refreshNow()}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>{t(section.title)}</Text>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}
        ListEmptyComponent={
          notifications.isInitialLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.emptyText}>{t('common.refreshing')}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('notifications.noNotifications')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <NotificationRowItem
            item={item}
            onMarkRead={(id) => void notifications.markRead(id)}
            isMarking={notifications.markingId === item.id}
            palette={palette}
            language={language}
            onOpen={async () => {
              setSelectedNotification(item);
              if (!item.isRead) await notifications.markRead(item.id);
            }}
          />
        )}
        ListFooterComponent={
          <View style={styles.listFooterHint}>
            <Text style={styles.listFooterHintText}>
              {t('notifications.title')} • {personalRows.length} • {notifications.connectionState}
            </Text>
          </View>
        }
      />
      <Modal
        visible={Boolean(selectedNotification)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setSelectedNotification(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeaderTextWrap}>
                <Text style={styles.detailTitle}>
                  {selectedNotification?.title ?? t('notifications.notification')}
                </Text>
                <Text style={styles.detailMeta}>
                  {selectedNotification
                    ? `${formatNotificationRelativeTime(selectedNotification.sentAt || selectedNotification.createdAt)} • ${formatNotificationDateTime(selectedNotification.sentAt || selectedNotification.createdAt)}`
                    : '—'}
                </Text>
              </View>
              <Pressable style={styles.detailCloseBtn} onPress={() => setSelectedNotification(null)}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailBodyCard}>
                <Text style={styles.detailBodyText}>
                  {(language === 'ar'
                    ? selectedNotification?.messageAr?.trim() ||
                      selectedNotification?.messageEn?.trim()
                    : selectedNotification?.messageEn?.trim() ||
                      selectedNotification?.messageAr?.trim()) ||
                    t('notifications.noDetails')}
                </Text>
              </View>

              <View style={styles.detailBadgesRow}>
                <View
                  style={[
                    styles.detailBadge,
                    selectedNotification?.isRead ? styles.detailBadgeRead : styles.detailBadgeUnread,
                    !selectedNotification?.isRead && {
                      borderColor: palette.primarySoft22,
                      backgroundColor: palette.primarySoft8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailBadgeText,
                      selectedNotification?.isRead
                        ? styles.detailBadgeTextRead
                        : styles.detailBadgeTextUnread,
                      !selectedNotification?.isRead && { color: palette.primary },
                    ]}
                  >
                    {selectedNotification?.isRead ? t('common.read') : t('common.unread')}
                  </Text>
                </View>
                {selectedNotification ? (
                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeText}>{notificationTypeLabel(selectedNotification)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.detailActionsRow}>
                {selectedInternalRoute ? (
                  <Pressable
                    style={[styles.detailPrimaryAction, { backgroundColor: palette.primary }]}
                    onPress={openSelectedInApp}
                  >
                    <Text style={styles.detailPrimaryActionText}>{selectedInAppLabel}</Text>
                  </Pressable>
                ) : null}
                {selectedExternalUrl ? (
                  <Pressable style={styles.detailSecondaryAction} onPress={() => void openSelectedLink()}>
                    <Text style={styles.detailSecondaryActionText}>{selectedExternalCtaLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <InAppWebViewerModal
        visible={webViewerState.visible}
        url={webViewerState.url}
        title={webViewerState.title}
        onClose={() =>
          setWebViewerState({
            visible: false,
            url: null,
            title: t('notifications.notification'),
          })
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
  sectionHeaderWrap: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeaderText: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: akColors.border,
  },
  rowCard: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 8,
    ...akShadow.soft,
    overflow: 'hidden',
  },
  rowCardRead: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5EAF2',
  },
  rowCardUnread: {
    backgroundColor: '#FCFEFD',
    borderColor: '#CFE4DA',
    borderLeftWidth: 4,
    borderLeftColor: akColors.primary,
  },
  rowCardPressed: {
    opacity: 0.97,
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
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  rowTitleUnread: {
    color: akColors.text,
    fontWeight: '700',
  },
  rowSubtitle: {
    marginTop: 3,
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
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
    color: '#1E293B',
    fontSize: 13,
    lineHeight: 20,
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
  detailRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  detailSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '84%',
    paddingTop: 8,
    paddingBottom: 18,
    ...akShadow.card,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: akColors.border,
    marginBottom: 8,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  detailHeaderTextWrap: {
    flex: 1,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  detailMeta: {
    color: akColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  detailCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
  },
  detailBodyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surfaceMuted,
    padding: 12,
    gap: 8,
  },
  detailBodyText: {
    color: akColors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  detailDivider: {
    height: 1,
    backgroundColor: akColors.border,
  },
  detailBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
  },
  detailBadgeRead: {
    backgroundColor: akColors.surfaceMuted,
  },
  detailBadgeUnread: {
    borderColor: 'rgba(42,62,53,0.22)',
    backgroundColor: 'rgba(42,62,53,0.08)',
  },
  detailBadgeText: {
    color: akColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  detailBadgeTextRead: {
    color: akColors.textMuted,
  },
  detailBadgeTextUnread: {
    color: akColors.primary,
  },
  detailActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  detailPrimaryAction: {
    borderRadius: 12,
    backgroundColor: akColors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailPrimaryActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  detailSecondaryAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailSecondaryActionText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
});
