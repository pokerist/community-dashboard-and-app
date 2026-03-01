import { akColors } from '../../theme/alkarma';
import type { BrandConfig } from './types';

export function hexToRgba(hex: string, alpha: number): string {
  const normalized = String(hex ?? '')
    .trim()
    .replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return `rgba(42,62,53,${alpha})`;
  }
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function deriveBrandPrimaryDark(primaryHex: string): string {
  const normalized = String(primaryHex ?? '')
    .trim()
    .replace('#', '');
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => `${ch}${ch}`)
          .join('')
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return akColors.primaryDark;

  const darken = (channelHex: string) =>
    Math.max(0, Math.round(parseInt(channelHex, 16) * 0.78))
      .toString(16)
      .padStart(2, '0');

  return `#${darken(full.slice(0, 2))}${darken(full.slice(2, 4))}${darken(
    full.slice(4, 6),
  )}`;
}

export function getBrandPalette(brand: BrandConfig) {
  const primary = brand.primaryColor || akColors.primary;
  const accent = brand.accentColor || akColors.gold;
  const secondary = brand.secondaryColor || akColors.gold;
  const primaryDark = deriveBrandPrimaryDark(primary);

  return {
    primary,
    primaryDark,
    accent,
    secondary,
    primarySoft8: hexToRgba(primary, 0.08),
    primarySoft10: hexToRgba(primary, 0.1),
    primarySoft12: hexToRgba(primary, 0.12),
    primarySoft18: hexToRgba(primary, 0.18),
    primarySoft22: hexToRgba(primary, 0.22),
    accentSoft12: hexToRgba(accent, 0.12),
  };
}
