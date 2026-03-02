import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { FireEvacuationStatus } from '../../features/community/types';
import { useI18n } from '../../features/i18n/provider';
import { akColors } from '../../theme/alkarma';

type FireEvacuationAlertModalProps = {
  visible: boolean;
  status: FireEvacuationStatus | null;
  isSubmitting: boolean;
  isHelpSubmitting: boolean;
  onConfirmSafe: () => void;
  onNeedHelp: () => void;
  onCloseAcknowledged: () => void;
  onRequestClose?: () => void;
};

export function FireEvacuationAlertModal({
  visible,
  status,
  isSubmitting,
  isHelpSubmitting,
  onConfirmSafe,
  onNeedHelp,
  onCloseAcknowledged,
  onRequestClose,
}: FireEvacuationAlertModalProps) {
  const { t, language } = useI18n();
  const hasAcknowledged = status?.acknowledged === true;
  const hasNeedHelp = status?.needsHelp === true;
  const title = status?.titleEn?.trim() || t('fire.title');
  const message =
    language === 'ar'
      ? status?.messageAr?.trim() || status?.messageEn?.trim() || t('fire.message')
      : status?.messageEn?.trim() || status?.messageAr?.trim() || t('fire.message');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onRequestClose ?? onCloseAcknowledged}
    >
      <View style={styles.backdrop}>
        <LinearGradient colors={['#7F1D1D', '#991B1B', '#7C2D12']} style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="warning" size={28} color="#FEF2F2" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.inlineStats}>
            <Ionicons name="people-outline" size={14} color="#FEE2E2" />
            <Text style={styles.inlineStatsText}>
              {t('fire.pendingResidents', {
                count: Number(status?.counters?.pending ?? 0),
              })}
            </Text>
          </View>

          {hasAcknowledged || hasNeedHelp ? (
            <>
              <View style={styles.ackBox}>
                <Ionicons
                  name={hasNeedHelp ? 'alert-circle' : 'checkmark-circle'}
                  size={18}
                  color={hasNeedHelp ? '#FBBF24' : '#34D399'}
                />
                <Text style={styles.ackText}>
                  {hasNeedHelp ? 'Help requested. Security team is notified.' : t('fire.confirmedSafe')}
                </Text>
              </View>
              <Pressable style={styles.secondaryButton} onPress={onCloseAcknowledged}>
                <Text style={styles.secondaryButtonText}>{t('common.close')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.primaryButton} onPress={onConfirmSafe} disabled={isSubmitting || isHelpSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#7F1D1D" /> : null}
                <Text style={styles.primaryButtonText}>
                  {isSubmitting ? t('fire.confirming') : t('fire.iAmSafe')}
                </Text>
              </Pressable>
              <Pressable style={styles.helpButton} onPress={onNeedHelp} disabled={isSubmitting || isHelpSubmitting}>
                {isHelpSubmitting ? <ActivityIndicator size="small" color="#FEF2F2" /> : null}
                <Text style={styles.helpButtonText}>
                  {isHelpSubmitting ? 'Sending help request...' : 'Need Help'}
                </Text>
              </Pressable>
            </>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(254,226,226,0.32)',
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 12,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    color: '#FEF2F2',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: '#FEE2E2',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  inlineStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  inlineStatsText: {
    color: '#FEE2E2',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#7F1D1D',
    fontSize: 14,
    fontWeight: '800',
  },
  helpButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(254,226,226,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  helpButtonText: {
    color: '#FEF2F2',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(254,226,226,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#FEE2E2',
    fontSize: 13,
    fontWeight: '700',
  },
  ackBox: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.35)',
    backgroundColor: 'rgba(16,185,129,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ackText: {
    color: akColors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
