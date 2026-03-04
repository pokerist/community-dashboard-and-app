import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBranding } from '../../features/branding/provider';
import { getBrandPalette } from '../../features/branding/palette';

type BrandedPageHeroProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  hideHeaderRow?: boolean;
  rightSlot?: ReactNode;
  compact?: boolean;
  fullBleed?: boolean;
  bleedSize?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BrandedPageHero({
  title,
  subtitle,
  onBack,
  showBack = true,
  hideHeaderRow = false,
  rightSlot,
  compact = true,
  fullBleed = true,
  bleedSize = 16,
  children,
  style,
}: BrandedPageHeroProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    try {
      navigation.navigate('Home');
    } catch {
      navigation.goBack();
    }
  };

  return (
    <LinearGradient
      colors={[palette.primary, palette.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.hero,
        compact && styles.heroCompact,
        fullBleed ? { marginHorizontal: -bleedSize } : null,
        { paddingTop: Math.max(insets.top, 8) + (compact ? 12 : 16) },
        style,
      ]}
    >
      {!hideHeaderRow ? (
        <View style={styles.topRow}>
          {showBack ? (
            <Pressable style={styles.backBtn} onPress={handleBack}>
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </Pressable>
          ) : (
            <View style={styles.sideSlotPlaceholder} />
          )}
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : <View style={styles.sideSlotPlaceholder} />}
        </View>
      ) : null}
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 18,
    minHeight: 172,
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  heroCompact: {
    minHeight: 158,
    paddingVertical: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 64,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlotPlaceholder: {
    width: 34,
    height: 34,
  },
  rightSlot: {
    minWidth: 34,
    alignItems: 'flex-end',
  },
});
