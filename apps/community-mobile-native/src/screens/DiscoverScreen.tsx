import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import { InAppWebViewerModal } from '../components/mobile/InAppWebViewerModal';
import type { AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { useBottomNavMetrics } from '../features/layout/BottomNavMetricsContext';
import { listDiscoverPlaces } from '../features/community/service';
import type { DiscoverPlace } from '../features/community/types';
import { API_BASE_URL } from '../config/env';
import { akColors, akRadius } from '../theme/alkarma';

function normalizeUrl(raw?: string | null): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) return value;
  return `https://${value}`;
}

function normalizeCategory(value?: string | null) {
  return String(value ?? '').trim() || 'Other';
}

export function DiscoverScreen({ session }: { session: AuthSession }) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const { contentInsetBottom } = useBottomNavMetrics();
  const [rows, setRows] = useState<DiscoverPlace[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const [viewerState, setViewerState] = useState<{
    visible: boolean;
    url: string | null;
    title: string;
  }>({ visible: false, url: null, title: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await listDiscoverPlaces(session.accessToken);
        if (!cancelled) {
          setRows(next);
          setBrokenImages({});
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load discover places');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session.accessToken]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(rows.map((row) => normalizeCategory(row.category))));
    return ['All', ...unique];
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const category = normalizeCategory(row.category);
      const categoryOk = activeCategory === 'All' || category === activeCategory;
      if (!categoryOk) return false;
      if (!query) return true;
      const hay = `${row.name ?? ''} ${row.category ?? ''} ${row.address ?? ''}`.toLowerCase();
      return hay.includes(query);
    });
  }, [activeCategory, rows, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: Math.max(110, contentInsetBottom) }]}>
        <BrandedPageHero title="Discover" subtitle="Places around your community." />

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={akColors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholder="Search by place name"
            placeholderTextColor={akColors.textSoft}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
          {categories.map((category) => {
            const active = category === activeCategory;
            return (
              <Pressable
                key={category}
                onPress={() => setActiveCategory(category)}
                style={[styles.categoryChip, active && { borderColor: palette.primary, backgroundColor: palette.primarySoft10 }]}
              >
                <Text style={[styles.categoryChipText, active && { color: palette.primary }]}>{category}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {!isLoading && visibleRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No places match your filters.</Text>
          </View>
        ) : null}

        {visibleRows.map((row) => {
          const link = normalizeUrl(row.mapLink);
          const imageUrl = row.imageFileId
            ? `${API_BASE_URL}/files/public/discover-image/${row.imageFileId}`
            : normalizeUrl(row.imageUrl);
          const imageBroken = Boolean(brokenImages[row.id]);
          return (
            <Pressable
              key={row.id}
              style={styles.card}
              onPress={() => {
                if (!link) return;
                setViewerState({
                  visible: true,
                  url: link,
                  title: row.name,
                });
              }}
            >
              {imageUrl && !imageBroken ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.cardImage}
                  resizeMode="cover"
                  onError={() =>
                    setBrokenImages((prev) => (prev[row.id] ? prev : { ...prev, [row.id]: true }))
                  }
                />
              ) : (
                <View style={[styles.cardImage, styles.placeholderImage]}>
                  <Ionicons name="image-outline" size={22} color={akColors.textSoft} />
                  <Text style={styles.placeholderText}>No image</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{row.name}</Text>
                <Text style={[styles.cardSub, { color: palette.primary }]}>{normalizeCategory(row.category)}</Text>
                {!!row.address ? <Text style={styles.cardMeta}>{row.address}</Text> : null}
                {!!row.workingHours ? <Text style={styles.cardMeta}>Hours: {row.workingHours}</Text> : null}
                {!!row.phone ? <Text style={styles.cardMeta}>Phone: {row.phone}</Text> : null}
                {link ? <Text style={[styles.openHint, { color: palette.primary }]}>Tap card to open link</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <InAppWebViewerModal
        visible={viewerState.visible}
        url={viewerState.url}
        title={viewerState.title}
        onClose={() => setViewerState({ visible: false, url: null, title: '' })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: akColors.bg,
  },
  container: {
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 0,
  },
  searchRow: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: akColors.text,
    fontSize: 13,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryChipText: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: akRadius.card,
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  card: {
    borderRadius: akRadius.card,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: akColors.border,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 132,
    backgroundColor: '#E2E8F0',
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderText: {
    color: akColors.textSoft,
    fontSize: 11,
  },
  cardBody: {
    padding: 12,
    gap: 5,
  },
  cardTitle: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  openHint: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
  },
});
