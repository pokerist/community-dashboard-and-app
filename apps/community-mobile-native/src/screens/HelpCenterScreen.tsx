import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandedPageHero } from '../components/mobile/BrandedPageHero';
import type { AuthSession } from '../features/auth/types';
import { useBranding } from '../features/branding/provider';
import { getBrandPalette } from '../features/branding/palette';
import { listHelpCenterEntries } from '../features/community/service';
import type { HelpCenterEntry } from '../features/community/types';
import { akColors, akRadius } from '../theme/alkarma';

export function HelpCenterScreen({ session }: { session: AuthSession }) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const [rows, setRows] = useState<HelpCenterEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const next = await listHelpCenterEntries(session.accessToken);
        if (!cancelled) setRows(next);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load help center');
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
        <BrandedPageHero
          title="Help Center"
          subtitle="Direct contacts for support and operations."
        />

        {isLoading ? <ActivityIndicator color={palette.primary} /> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        {!isLoading && rows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No help contacts configured yet.</Text>
          </View>
        ) : null}

        {rows.map((row) => (
          <View key={row.id} style={styles.card}>
            <Text style={styles.cardTitle}>{row.title}</Text>
            <Text style={styles.cardSub}>{row.availability || 'Always available'}</Text>
            <Pressable
              style={[styles.callBtn, { backgroundColor: palette.primary }]}
              onPress={() => {
                const phone = String(row.phone || '').trim();
                if (!phone) return;
                void Linking.openURL(`tel:${phone}`);
              }}
            >
              <Text style={styles.callBtnText}>{row.phone}</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
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
    gap: 8,
  },
  cardTitle: {
    color: akColors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  callBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: akColors.textMuted,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
