import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useBranding } from '../features/branding/provider';
import type { OnboardingSlide } from '../features/branding/types';
import { akColors, akShadow } from '../theme/alkarma';

const logoImage = require('../../assets/branding/alkarma-logo.png');

type OnboardingScreenProps = {
  onComplete: () => void;
};

type Slide = {
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
};

const slides: Slide[] = [
  {
    title: 'Welcome to Al Karma',
    subtitle: 'SMART LIVING',
    description:
      'Experience luxury living with cutting-edge smart home technology and world-class amenities across our premium developments.',
    imageUrl:
      'https://images.unsplash.com/photo-1560613654-ea1945efc370?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
  {
    title: 'Your Compounds',
    subtitle: 'KARMA • KARMA GATES • KAY',
    description:
      'Access all your properties in one place. Manage services, payments, and security across your Al Karma developments.',
    imageUrl:
      'https://images.unsplash.com/photo-1643892605308-70a6559cfd0a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
  {
    title: 'Smart & Secure',
    subtitle: 'YOUR SAFETY, OUR PRIORITY',
    description:
      'Generate QR codes for visitors, track deliveries, manage complaints, and stay connected with the smart community system.',
    imageUrl:
      'https://images.unsplash.com/photo-1633194883650-df448a10d554?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
  },
];

const bgImage =
  'https://images.unsplash.com/photo-1622015663381-d2e05ae91b72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets();
  const { brand, onboarding } = useBranding();
  const [index, setIndex] = useState(0);
  const configuredSlides = useMemo(() => {
    const source =
      onboarding?.enabled !== false && Array.isArray(onboarding.slides) && onboarding.slides.length > 0
        ? onboarding.slides
        : slides;
    return source
      .map((slide) => {
        const imageUrl =
          (slide as OnboardingSlide)?.imageUrl ??
          (slide as Slide).imageUrl ??
          '';
        const title = String((slide as OnboardingSlide)?.title ?? (slide as Slide).title ?? '').trim();
        if (!title || !imageUrl) return null;
        return {
          title,
          subtitle: String((slide as OnboardingSlide)?.subtitle ?? (slide as Slide).subtitle ?? '').trim(),
          description: String((slide as OnboardingSlide)?.description ?? (slide as Slide).description ?? '').trim(),
          imageUrl,
        } satisfies Slide;
      })
      .filter((slide): slide is Slide => Boolean(slide));
  }, [onboarding]);
  const runtimeSlides = useMemo(() => {
    const company = brand.companyName || 'Al Karma';
    const appName = brand.appDisplayName || 'Community App';
    const tagline = (brand.tagline || 'SMART LIVING').toUpperCase();
    const sourceSlides = configuredSlides.length > 0 ? configuredSlides : slides;
    return sourceSlides.map((s, i) =>
      i === 0
        ? {
            ...s,
            title: `Welcome to ${company}`,
            subtitle: tagline,
            description:
              `Experience premium living with ${appName}. Access services, payments, visitors, and community updates in one place.`,
          }
        : s,
    );
  }, [brand.appDisplayName, brand.companyName, brand.tagline, configuredSlides]);
  const slide = runtimeSlides[index];
  const brandPrimary = brand.primaryColor || akColors.primary;
  const brandAccent = brand.accentColor || akColors.gold;
  const logoSource =
    brand.logoUrl && brand.logoUrl.trim()
      ? ({ uri: brand.logoUrl } as const)
      : logoImage;

  const nextLabel = useMemo(
    () => (index === runtimeSlides.length - 1 ? 'GET STARTED' : 'NEXT'),
    [index, runtimeSlides.length],
  );

  const handleNext = () => {
    if (index < runtimeSlides.length - 1) {
      setIndex((v) => v + 1);
      return;
    }
    onComplete();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ImageBackground source={{ uri: bgImage }} style={styles.bg} resizeMode="cover">
        <LinearGradient
          colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.60)', 'rgba(0,0,0,0.84)']}
          style={styles.overlay}
        />

        <View style={styles.decorWrap} pointerEvents="none">
          <View style={styles.blurOrbTop} />
          <View style={styles.blurOrbBottom} />
        </View>

        <View
          style={[
            styles.shell,
            {
              paddingTop: Math.max(insets.top, 8) + 8,
              paddingBottom: Math.max(insets.bottom, 10) + 8,
            },
          ]}
        >
          <View style={styles.topBar}>
            <View />
            <Pressable onPress={onComplete} hitSlop={8}>
              <Text style={styles.skipText}>SKIP</Text>
            </Pressable>
          </View>

          <View style={styles.centerWrap}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />

            <View style={styles.slideImageWrap}>
              <Image source={{ uri: slide.imageUrl }} style={styles.slideImage} resizeMode="cover" />
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <View style={styles.subtitleDivider} />
            <Text style={[styles.subtitle, { color: brandAccent }]}>{slide.subtitle}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>

          <View style={styles.bottomWrap}>
            <View style={styles.dotsRow}>
              {runtimeSlides.map((_, dotIndex) => {
                const active = dotIndex === index;
                return (
                  <Pressable
                    key={`dot-${dotIndex}`}
                    onPress={() => setIndex(dotIndex)}
                    hitSlop={8}
                    style={[styles.dot, active && styles.dotActive, active && { backgroundColor: brandAccent }]}
                  />
                );
              })}
            </View>

            <Pressable onPress={handleNext} style={styles.nextButton}>
              <View style={styles.nextButtonInner}>
                <Text style={styles.nextButtonText}>{nextLabel}</Text>
                <Ionicons name="chevron-forward" size={18} color={brandPrimary} />
              </View>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  decorWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blurOrbTop: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -70,
    right: -90,
    backgroundColor: 'rgba(201,169,97,0.10)',
  },
  blurOrbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -80,
    left: -90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shell: {
    flex: 1,
    paddingHorizontal: 22,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 34,
  },
  skipText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
  },
  logo: {
    width: 150,
    height: 56,
    marginBottom: 22,
  },
  slideImageWrap: {
    width: '84%',
    maxWidth: 300,
    aspectRatio: 1,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 22,
    ...akShadow.card,
  },
  slideImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  subtitleDivider: {
    width: 68,
    height: 1,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(201,169,97,0.55)',
  },
  subtitle: {
    color: akColors.gold,
    fontSize: 11,
    letterSpacing: 2.4,
    fontWeight: '500',
    textAlign: 'center',
  },
  description: {
    marginTop: 18,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 13,
    lineHeight: 25,
    textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: 340,
  },
  bottomWrap: {
    gap: 18,
    paddingBottom: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    width: 28,
    backgroundColor: akColors.gold,
  },
  nextButton: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    ...akShadow.card,
  },
  nextButtonInner: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: akColors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
