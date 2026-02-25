import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { akColors, akRadius, akShadow } from '../../theme/alkarma';

export function ScreenCard(props: {
  title?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      {props.title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{props.title}</Text>
          {props.actionLabel && props.onActionPress ? (
            <Pressable onPress={props.onActionPress}>
              <Text style={styles.action}>{props.actionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {props.children}
    </View>
  );
}

export function InlineError(props: { message: string | null }) {
  if (!props.message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{props.message}</Text>
    </View>
  );
}

export function EmptyState(props: { text: string }) {
  return <Text style={styles.emptyText}>{props.text}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: akColors.surface,
    borderRadius: akRadius.card,
    borderWidth: 1,
    borderColor: akColors.border,
    padding: 14,
    gap: 10,
    ...akShadow.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: akColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  action: {
    color: akColors.primary,
    fontWeight: '600',
    fontSize: 12,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: akColors.dangerBorder,
    backgroundColor: akColors.dangerBg,
    borderRadius: akRadius.sm,
    padding: 10,
  },
  errorText: {
    color: akColors.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  emptyText: {
    color: akColors.textMuted,
    fontSize: 13,
  },
});

export const primitiveStyles = styles;
