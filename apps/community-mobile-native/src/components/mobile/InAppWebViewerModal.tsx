import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { useBranding } from '../../features/branding/provider';
import { getBrandPalette } from '../../features/branding/palette';
import { akColors } from '../../theme/alkarma';

type InAppWebViewerModalProps = {
  visible: boolean;
  url: string | null;
  title?: string;
  onClose: () => void;
};

export function InAppWebViewerModal({
  visible,
  url,
  title,
  onClose,
}: InAppWebViewerModalProps) {
  const { brand } = useBranding();
  const palette = getBrandPalette(brand);
  const webViewRef = useRef<WebView | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const safeTitle = useMemo(() => title?.trim() || 'In-App Browser', [title]);

  const handleNavChange = (state: WebViewNavigation) => {
    setCanGoBack(Boolean(state.canGoBack));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            style={[styles.headerBtn, !canGoBack && styles.headerBtnDisabled]}
            onPress={() => webViewRef.current?.goBack()}
            disabled={!canGoBack}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={canGoBack ? akColors.text : akColors.textSoft}
            />
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>
            {safeTitle}
          </Text>
          <Pressable style={styles.headerBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color={akColors.text} />
          </Pressable>
        </View>

        {url ? (
          <View style={styles.webWrap}>
            <WebView
              ref={webViewRef}
              source={{ uri: url }}
              style={styles.web}
              onNavigationStateChange={handleNavChange}
              onLoadStart={() => setIsLoading(true)}
              onLoadEnd={() => setIsLoading(false)}
              startInLoadingState
            />
            {isLoading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color={palette.primary} />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No link available.</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 48,
    borderBottomWidth: 1,
    borderBottomColor: akColors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: akColors.surfaceMuted,
  },
  headerBtnDisabled: {
    opacity: 0.45,
  },
  title: {
    flex: 1,
    color: akColors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  webWrap: {
    flex: 1,
  },
  web: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    color: akColors.textMuted,
  },
});
