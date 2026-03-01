import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { InAppWebViewerModal } from '../components/mobile/InAppWebViewerModal';
import type { AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { listDiscoverPlaces } from '../features/community/service';
import type { DiscoverPlace } from '../features/community/types';
import { akColors, akRadius } from '../theme/alkarma';

function normalizeUrl(raw?: string | null): string | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value)) return value;
  return `https://${value}`;
}

export function DiscoverScreen({ session }: { session: AuthSession }) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const [rows, setRows] = useState<DiscoverPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        if (!cancelled) setRows(next);
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>Nearby places curated by management.</Text>

        {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {!isLoading && rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No places published yet.</Text>
          </View>
        ) : null}

        {rows.map((row) => {
          const link = normalizeUrl(row.mapLink);
          return (
            <View key={row.id} style={styles.card}>
              <Text style={styles.cardTitle}>{row.name}</Text>
              {!!row.category ? (
                <Text style={[styles.cardSub, { color: palette.primary }]}>{row.category}</Text>
              ) : null}
              {!!row.address ? <Text style={styles.cardMeta}>{row.address}</Text> : null}
              {!!row.workingHours ? (
                <Text style={styles.cardMeta}>Working Hours: {row.workingHours}</Text>
              ) : null}
              {!!row.distanceHint ? <Text style={styles.cardMeta}>{row.distanceHint}</Text> : null}
              {link ? (
                <Pressable
                  style={[styles.openBtn, { backgroundColor: palette.primary }]}
                  onPress={() =>
                    setViewerState({
                      visible: true,
                      url: link,
                      title: row.name,
                    })
                  }
                >
                  <Text style={styles.openBtnText}>Open Map</Text>
                </Pressable>
              ) : null}
            </View>
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
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  title: {
    color: akColors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: akColors.textMuted,
    fontSize: 13,
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
    backgroundColor: akColors.surface,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 6,
  },
  cardTitle: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    color: akColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  cardMeta: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  openBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.textMuted,
    marginTop: 4,
  },
  openBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
