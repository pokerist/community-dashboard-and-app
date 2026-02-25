import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { akColors, akRadius, akShadow } from '../../theme/alkarma';
import { formatCurrency, formatDateTime } from '../../utils/format';
import type { PayableItem } from '../../features/community/types';

const PAYMENT_METHODS = [
  'Card',
  'Wallet',
  'Bank Transfer',
  'Office Cash',
] as const;

export function DemoPaymentModal({
  visible,
  item,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  item: PayableItem | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    paymentMethod: string;
    cardLast4?: string;
    notes?: string;
  }) => Promise<void> | void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [cardLast4, setCardLast4] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setPaymentMethod(PAYMENT_METHODS[0]);
    setCardLast4('');
    setNotes('');
    setLocalError(null);
  }, [visible, item?.key]);

  const title = useMemo(() => item?.title ?? 'Payment', [item]);

  const submit = async () => {
    if (!item?.invoiceId) {
      setLocalError('This payable item is not linked to a payable invoice yet.');
      return;
    }
    if (!paymentMethod.trim()) {
      setLocalError('Payment method is required.');
      return;
    }
    if (paymentMethod === 'Card' && cardLast4.trim() && !/^\d{4}$/.test(cardLast4.trim())) {
      setLocalError('Card last 4 digits must be exactly 4 numbers.');
      return;
    }
    setLocalError(null);
    await onConfirm({
      paymentMethod,
      cardLast4: cardLast4.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheetWrap} edges={['bottom']}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <Text style={styles.title}>Payment</Text>
                <Text style={styles.subtitle}>Secure payment simulation for this environment</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={18} color={akColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{title}</Text>
              <Text style={styles.summaryAmount}>{formatCurrency(item?.amount ?? 0)}</Text>
              <Text style={styles.summaryMeta}>
                {item?.dueDate ? `Due ${formatDateTime(item.dueDate).split(',')[0]}` : 'No due date'}
                {item?.status ? ` • ${item.status}` : ''}
              </Text>
            </View>

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodsRow}>
              {PAYMENT_METHODS.map((method) => {
                const active = paymentMethod === method;
                return (
                  <Pressable
                    key={method}
                    onPress={() => setPaymentMethod(method)}
                    style={[styles.methodChip, active && styles.methodChipActive]}
                  >
                    <Text style={[styles.methodChipText, active && styles.methodChipTextActive]}>
                      {method}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Card Last 4 (optional)</Text>
            <TextInput
              value={cardLast4}
              onChangeText={setCardLast4}
              style={styles.input}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="4242"
              placeholderTextColor={akColors.textSoft}
            />

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={3}
              placeholder="Payment note (optional)"
              placeholderTextColor={akColors.textSoft}
            />

            {localError ? (
              <Text style={styles.errorText}>{localError}</Text>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable onPress={onClose} style={styles.cancelBtn} disabled={isSubmitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submit()}
                style={[styles.confirmBtn, isSubmitting && styles.buttonDisabled]}
                disabled={isSubmitting}
              >
                {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.confirmBtnText}>
                  {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.35)',
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: akColors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
    ...akShadow.card,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 4,
    backgroundColor: akColors.border,
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  flex: { flex: 1 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
    borderWidth: 1,
    borderColor: akColors.border,
  },
  title: {
    color: akColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    color: akColors.textMuted,
    fontSize: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: akRadius.lg,
    padding: 12,
    backgroundColor: akColors.surfaceMuted,
    gap: 3,
  },
  summaryTitle: {
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryAmount: {
    color: akColors.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  summaryMeta: {
    color: akColors.textMuted,
    fontSize: 11,
  },
  label: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  methodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  methodChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: akColors.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  methodChipActive: {
    backgroundColor: akColors.primary,
    borderColor: akColors.primary,
  },
  methodChipText: {
    color: akColors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  methodChipTextActive: {
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: akColors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: akColors.text,
    backgroundColor: '#fff',
    fontSize: 13,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: akColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    color: akColors.text,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: akColors.primary,
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
