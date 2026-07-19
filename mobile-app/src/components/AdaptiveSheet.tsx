import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal as RNModal, ScrollView, KeyboardAvoidingView, Platform, Animated, PanResponder, Dimensions } from 'react-native';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface AdaptiveSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function AdaptiveSheet({ visible, onClose, title, children }: AdaptiveSheetProps) {
  const { colors } = useTheme();
  const panY = useRef(new Animated.Value(0)).current;

  const resetPosition = () => {
    Animated.spring(panY, { toValue: 0, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) panY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) onClose();
        else resetPosition();
      },
    })
  ).current;

  const styles = useMemo(() => StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { flex: 1, backgroundColor: colors.overlay },
    sheetBase: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      maxHeight: SCREEN_HEIGHT * 0.85,
      paddingBottom: spacing.xxxl,
    },
    handle: {
      width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2,
      alignSelf: 'center', marginTop: spacing.sm + 2, marginBottom: spacing.xs,
    },
    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      padding: spacing.lg, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.tagBg,
    },
    title: { fontSize: fontSize.lg + 1, fontWeight: fontWeight.bold, color: colors.text },
    closeBtn: { fontSize: fontSize.xl, color: colors.textTertiary, padding: spacing.xs },
  }), [colors]);

  return (
    <RNModal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <Animated.View style={[styles.sheetBase, { transform: [{ translateY: panY }] }]} {...panResponder.panHandlers}>
          <View style={styles.handle} />
          {title && (
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Close" accessibilityRole="button">
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}
