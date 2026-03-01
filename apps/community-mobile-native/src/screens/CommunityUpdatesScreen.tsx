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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthSession } from '../features/auth/types';
import { InAppWebViewerModal } from '../components/mobile/InAppWebViewerModal';
import {
  communityUpdateTitle,
  formatNotificationDateTime,
  formatNotificationRelativeTime,
  isCommunityUpdateNotification,
} from '../features/notifications/presentation';
import { useI18n } from '../features/i18n/provider';
import { useNotificationRealtime } from '../features/notifications/realtime';
import type { MobileNotificationRow } from '../features/notifications/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { akColors, akRadius, akShadow } from '../theme/alkarma';

type FilterMode = 'all' | 'unread';

type CommunityUpdatesScreenProps = {
  session: AuthSession;
  onOpenInAppRoute?: (payload: {
    route?: string;
    entityType?: string;
    entityId?: string;
    notificationId?: string;
  }) => void;
};

function normalizeExternalUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function communityVisual(
  type: string | undefined,
  palette: ReturnType<typeof getBrandPalette>,
) {
  const key = String(type ?? '').toUpperCase();
  if (key.includes('EMERGENCY')) {
    return {
      icon: 'warning-outline' as const,
      iconColor: '#DC2626',
      bg: 'rgba(239,68,68,0.10)',
      border: 'rgba(239,68,68,0.20)',
    };
  }
  if (key.includes('MAINTENANCE')) {
    return {
      icon: 'construct-outline' as const,
      iconColor: '#D97706',
      bg: 'rgba(245,158,11,0.10)',
      border: 'rgba(245,158,11,0.20)',
    };
  }
  if (key.includes('EVENT')) {
    return {
      icon: 'calendar-outline' as const,
      iconColor: '#059669',
      bg: 'rgba(16,185,129,0.10)',
      border: 'rgba(16,185,129,0.20)',
    };
  }
  return {
    icon: 'megaphone-outline' as const,
    iconColor: palette.primary,
    bg: palette.primarySoft8,
    border: palette.primarySoft18,
  };
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

function CommunityUpdateRow({
  item,
  isMarking,
  onMarkRead,
  onOpen,
  palette,
}: {
  item: MobileNotificationRow;
  isMarking: boolean;
  onMarkRead: (id: string) => void;
  onOpen: () => void;
  palette: ReturnType<typeof getBrandPalette>;
}) {
  const { t } = useI18n();
  const visual = communityVisual(item.type, palette);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        !item.isRead && [
          styles.cardUnread,
          { borderColor: palette.primarySoft22, backgroundColor: palette.primarySoft8 },
        ],
        pressed && styles.cardPressed,
      ]}
      onPress={onOpen}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: visual.bg, borderColor: visual.border }]}>
          <Ionicons name={visual.icon} size={18} color={visual.iconColor} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={[styles.cardTitle, !item.isRead && styles.cardTitleUnread]} numberOfLines={2}>
            {communityUpdateTitle(item)}
          </Text>
          <Text style={styles.cardMeta}>
            {formatNotificationRelativeTime(item.sentAt || item.createdAt)} •{' '}
            {formatNotificationDateTime(item.sentAt || item.createdAt)}
          </Text>
        </View>
        {!item.isRead ? <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} /> : null}
      </View>

      <Text style={styles.cardMessage}>{item.messageEn || t('communityUpdates.noDetails')}</Text>

      <View style={styles.cardFooter}>
        <View
          style={[
            styles.statusPill,
            item.isRead ? styles.statusPillRead : styles.statusPillUnread,
            !item.isRead && {
              borderColor: palette.primarySoft18,
              backgroundColor: palette.primarySoft8,
            },
          ]}
        >
          <Text
            style={[
              styles.statusPillText,
              item.isRead ? styles.statusPillTextRead : styles.statusPillTextUnread,
              !item.isRead && { color: palette.primary },
            ]}
          >
            {item.isRead ? t('common.read') : t('common.unread')}
          </Text>
        </View>

        {!item.isRead ? (
          <Pressable
            onPress={() => onMarkRead(item.id)}
            disabled={isMarking}
            style={[
              styles.markReadButton,
              { borderColor: palette.primarySoft18 },
              isMarking && styles.markReadButtonDisabled,
            ]}
          >
            {isMarking ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <Text style={[styles.markReadText, { color: palette.primary }]}>
                {t('communityUpdates.markAsRead')}
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function CommunityUpdatesScreen({ onOpenInAppRoute }: CommunityUpdatesScreenProps) {
  const { t } = useI18n();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const insets = useSafeAreaInsets();
  const realtime = useNotificationRealtime();
  const [filter, setFilter] = useState<FilterMode>('all');
  const [selectedUpdate, setSelectedUpdate] = useState<MobileNotificationRow | null>(null);
  const [webViewerState, setWebViewerState] = useState<{
    visible: boolean;
    url: string | null;
    title: string;
  }>({
    visible: false,
    url: null,
    title: t('communityUpdates.communityUpdate'),
  });

  const communityRows = useMemo(
    () => realtime.rows.filter(isCommunityUpdateNotification),
    [realtime.rows],
  );
  const filteredRows = useMemo(() => {
    if (filter === 'unread') return communityRows.filter((r) => !r.isRead);
    return communityRows;
  }, [communityRows, filter]);

  const unreadCommunityCount = useMemo(
    () => communityRows.filter((r) => !r.isRead).length,
    [communityRows],
  );
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
          selectedUpdate?.payload?.externalUrl ??
            selectedUpdate?.payload?.ctaUrl ??
            selectedUpdate?.payload?.linkUrl ??
            '',
        ) || null,
      ),
    [selectedUpdate],
  );
  const selectedInternalRoute = useMemo(() => {
    const raw = String(selectedUpdate?.payload?.route ?? '').trim();
    if (!raw) return null;
    return raw;
  }, [selectedUpdate]);
  const selectedExternalCtaLabel = useMemo(() => {
    const raw = String(
      selectedUpdate?.payload?.ctaLabel ??
        selectedUpdate?.payload?.ctaText ??
        '',
    ).trim();
    return raw || t('common.openLink');
  }, [selectedUpdate, t]);
  const selectedInAppLabel = useMemo(() => {
    const raw = String(selectedUpdate?.payload?.openInAppLabel ?? '').trim();
    return raw || t('common.openInApp');
  }, [selectedUpdate, t]);

  const openSelectedLink = async () => {
    if (!selectedExternalUrl) return;
    setWebViewerState({
      visible: true,
      url: selectedExternalUrl,
      title: selectedUpdate?.title || t('communityUpdates.communityUpdate'),
    });
  };
  const openSelectedInAppRoute = () => {
    if (!selectedInternalRoute || !onOpenInAppRoute) return;
    onOpenInAppRoute({
      route: selectedInternalRoute,
      entityType:
        typeof selectedUpdate?.payload?.entityType === 'string'
          ? selectedUpdate.payload.entityType
          : undefined,
      entityId:
        typeof selectedUpdate?.payload?.entityId === 'string'
          ? selectedUpdate.payload.entityId
          : undefined,
      notificationId: selectedUpdate?.id,
    });
    setSelectedUpdate(null);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={[styles.topWrap, { paddingTop: Math.max(insets.top, 8) + 8 }]}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{t('communityUpdates.title')}</Text>
          <Text style={styles.subtitle}>
            {t('communityUpdates.subtitle')}
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
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              {t('common.all')} ({communityRows.length})
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
            <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
              {t('common.unread')} ({unreadCommunityCount})
            </Text>
          </Pressable>
          <Pressable style={styles.refreshChip} onPress={() => void realtime.refreshNow()}>
            <Text style={styles.refreshChipText}>
              {realtime.isRefreshing || realtime.isInitialLoading
                ? t('common.refreshing')
                : t('common.refresh')}
            </Text>
          </Pressable>
        </View>

        {realtime.errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{realtime.errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <SectionList
        sections={groupedSections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={realtime.isRefreshing} onRefresh={() => void realtime.refreshNow()} />
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeaderText}>{t(section.title)}</Text>
            <View style={styles.sectionHeaderLine} />
          </View>
        )}
        ListEmptyComponent={
          realtime.isInitialLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color={palette.primary} />
              <Text style={styles.emptyText}>{t('common.refreshing')}</Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('communityUpdates.noUpdates')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <CommunityUpdateRow
              item={item}
              isMarking={realtime.markingId === item.id}
              onMarkRead={(id) => void realtime.markRead(id)}
              palette={palette}
              onOpen={async () => {
                setSelectedUpdate(item);
                if (!item.isRead) {
                  await realtime.markRead(item.id);
                }
              }}
            />
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footerHint}>
            <Text style={styles.footerHintText}>
              {t('communityUpdates.title')} • {communityRows.length} • {realtime.connectionState}
            </Text>
          </View>
        }
      />
      <Modal
        visible={Boolean(selectedUpdate)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedUpdate(null)}
      >
        <View style={styles.detailRoot}>
          <Pressable style={styles.detailBackdrop} onPress={() => setSelectedUpdate(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeaderRow}>
              <View style={styles.detailHeaderTextWrap}>
                <Text style={styles.detailTitle}>
                  {selectedUpdate
                    ? communityUpdateTitle(selectedUpdate)
                    : t('communityUpdates.communityUpdate')}
                </Text>
                <Text style={styles.detailMeta}>
                  {selectedUpdate
                    ? `${formatNotificationRelativeTime(
                        selectedUpdate.sentAt || selectedUpdate.createdAt,
                      )} • ${formatNotificationDateTime(selectedUpdate.sentAt || selectedUpdate.createdAt)}`
                    : '—'}
                </Text>
              </View>
              <Pressable style={styles.detailCloseBtn} onPress={() => setSelectedUpdate(null)}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailBodyCard}>
                <Text style={styles.detailBodyText}>
                  {selectedUpdate?.messageEn?.trim() || t('communityUpdates.noDetails')}
                </Text>
                {selectedUpdate?.messageAr?.trim() ? (
                  <>
                    <View style={styles.detailDivider} />
                    <Text style={styles.detailBodyText}>{selectedUpdate.messageAr}</Text>
                  </>
                ) : null}
              </View>

              <View style={styles.detailBadgesRow}>
                <View
                  style={[
                    styles.detailBadge,
                    selectedUpdate?.isRead ? styles.detailBadgeRead : styles.detailBadgeUnread,
                    !selectedUpdate?.isRead && {
                      borderColor: palette.primarySoft22,
                      backgroundColor: palette.primarySoft8,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.detailBadgeText,
                      selectedUpdate?.isRead
                        ? styles.detailBadgeTextRead
                        : styles.detailBadgeTextUnread,
                      !selectedUpdate?.isRead && { color: palette.primary },
                    ]}
                  >
                    {selectedUpdate?.isRead ? t('common.read') : t('common.unread')}
                  </Text>
                </View>
                {selectedUpdate?.type ? (
                  <View style={styles.detailBadge}>
                    <Text style={styles.detailBadgeText}>{String(selectedUpdate.type).replace(/_/g, ' ')}</Text>
                  </View>
                ) : null}
              </View>
            </ScrollView>

            <View style={styles.detailFooter}>
              {selectedInternalRoute && selectedInternalRoute !== '/community-updates' ? (
                <Pressable style={styles.detailSecondaryBtn} onPress={openSelectedInAppRoute}>
                  <Text style={styles.detailSecondaryBtnText}>{selectedInAppLabel}</Text>
                </Pressable>
              ) : null}
              {selectedExternalUrl ? (
                <Pressable
                  style={[styles.detailPrimaryBtn, { backgroundColor: palette.primary }]}
                  onPress={() => void openSelectedLink()}
                >
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.detailPrimaryBtnText}>{selectedExternalCtaLabel}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.detailSecondaryBtn} onPress={() => setSelectedUpdate(null)}>
                <Text style={styles.detailSecondaryBtnText}>{t('common.cancel')}</Text>
              </Pressable>
            </View>
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
            title: t('communityUpdates.communityUpdate'),
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
  topWrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  headerCard: {
    backgroundColor: akColors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...akShadow.soft,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: akColors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
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
  filterText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
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
    flexGrow: 1,
  },
  rowWrap: {
    marginBottom: 10,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeaderText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(203,213,225,0.8)',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 12,
    gap: 10,
    ...akShadow.soft,
  },
  cardPressed: {
    opacity: 0.96,
  },
  cardUnread: {
    borderColor: 'rgba(42,62,53,0.20)',
    backgroundColor: '#FCFEFD',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  cardTitleUnread: {
    fontWeight: '700',
  },
  cardMeta: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  unreadDot: {
    marginTop: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: akColors.primary,
  },
  cardMessage: {
    color: akColors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusPillRead: {
    backgroundColor: akColors.surfaceMuted,
    borderColor: akColors.border,
  },
  statusPillUnread: {
    backgroundColor: 'rgba(42,62,53,0.08)',
    borderColor: 'rgba(42,62,53,0.16)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextRead: {
    color: akColors.textMuted,
  },
  statusPillTextUnread: {
    color: akColors.primary,
  },
  markReadButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markReadButtonDisabled: {
    opacity: 0.7,
  },
  markReadText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  footerHint: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  footerHintText: {
    color: akColors.textSoft,
    fontSize: 11,
  },
  detailRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.20)',
  },
  detailSheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.9)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    maxHeight: '78%',
    ...akShadow.card,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 10,
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  detailTitle: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
  },
  detailMeta: {
    color: akColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
  },
  detailContent: {
    paddingTop: 12,
    gap: 12,
  },
  detailBodyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#FCFDFE',
    padding: 12,
    gap: 10,
  },
  detailBodyText: {
    color: akColors.text,
    fontSize: 14,
    lineHeight: 20,
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
    borderColor: 'rgba(42,62,53,0.20)',
    backgroundColor: 'rgba(42,62,53,0.06)',
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
  detailFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  detailPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: akColors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailPrimaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  detailSecondaryBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: akColors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSecondaryBtnText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
});
