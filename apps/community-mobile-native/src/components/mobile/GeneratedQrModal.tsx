import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { AccessQrRow } from '../../features/community/types';
import { akColors, akShadow } from '../../theme/alkarma';
import { formatDateTime } from '../../utils/format';

type GeneratedQrModalProps = {
  visible: boolean;
  qrRow: AccessQrRow | null;
  qrImageBase64?: string | null;
  onClose: () => void;
  onViewHistory?: () => void;
  onToast?: (variant: 'success' | 'error' | 'info', title: string, description?: string) => void;
};

function normalizeBase64(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image')) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

function fileBase64Payload(raw?: string | null) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:')) {
    const split = trimmed.split(',');
    return split.length > 1 ? split[1] : null;
  }
  return trimmed;
}

export function GeneratedQrModal({
  visible,
  qrRow,
  qrImageBase64,
  onClose,
  onViewHistory,
  onToast,
}: GeneratedQrModalProps) {
  const [sharingBusy, setSharingBusy] = useState(false);
  const imageUri = useMemo(() => normalizeBase64(qrImageBase64), [qrImageBase64]);

  const handleShare = async () => {
    const payload = fileBase64Payload(qrImageBase64);
    if (!payload) {
      onToast?.('error', 'QR image is not available to share');
      return;
    }
    setSharingBusy(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        onToast?.('info', 'Sharing is not available on this device');
        return;
      }
      const baseDir =
        FileSystem.cacheDirectory ??
        FileSystem.documentDirectory ??
        undefined;
      if (!baseDir) {
        onToast?.('error', 'Could not access local storage for sharing');
        return;
      }
      const fileUri = `${baseDir}qr-${qrRow?.qrId ?? qrRow?.id ?? Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, payload, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await Sharing.shareAsync(fileUri, { mimeType: 'image/png' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share QR image';
      onToast?.('error', 'Failed to share QR image', message);
    } finally {
      setSharingBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons name="qrcode" size={20} color={akColors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>QR Code Ready</Text>
              <Text style={styles.subtitle}>
                {qrRow?.qrId ?? qrRow?.id ?? 'Generated access permit'}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={18} color={akColors.text} />
            </Pressable>
          </View>

          <View style={styles.qrWrap}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <View style={styles.qrFallback}>
                <MaterialCommunityIcons name="qrcode" size={54} color={akColors.textSoft} />
                <Text style={styles.qrFallbackText}>QR image unavailable</Text>
              </View>
            )}
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLine}>
              Type: {String(qrRow?.type ?? 'QR').replace(/_/g, ' ')}
            </Text>
            {qrRow?.visitorName ? (
              <Text style={styles.metaLine}>Visitor: {qrRow.visitorName}</Text>
            ) : null}
            <Text style={styles.metaLine}>
              Validity: {formatDateTime(qrRow?.validFrom)} → {formatDateTime(qrRow?.validTo)}
            </Text>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Close</Text>
            </Pressable>
            {onViewHistory ? (
              <Pressable style={styles.secondaryBtn} onPress={onViewHistory}>
                <Text style={styles.secondaryBtnText}>History</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.primaryBtn, sharingBusy && styles.disabled]}
              onPress={() => void handleShare()}
              disabled={sharingBusy}
            >
              {sharingBusy ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="share-outline" size={16} color="#fff" />
              )}
              <Text style={styles.primaryBtnText}>{sharingBusy ? 'Sharing...' : 'Share'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.44)',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
    ...akShadow.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(42,62,53,0.08)',
  },
  flex: { flex: 1 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  title: {
    color: akColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: akColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  qrWrap: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  qrImage: {
    width: 220,
    height: 220,
    maxWidth: '100%',
  },
  qrFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qrFallbackText: {
    color: akColors.textMuted,
    fontSize: 12,
  },
  metaCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
    padding: 10,
    gap: 4,
  },
  metaLine: {
    color: akColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1.3,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: akColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
