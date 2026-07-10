import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { copilotApi } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { spacing, radius, fontSize, fontWeight } from '../theme/tokens';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'What are my top expenses?',
  'Can I afford a ₹50,000 purchase?',
  'Show me my budget status',
  'How is my savings goal progress?',
];

export default function CopilotScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  msgList: { padding: spacing.lg, paddingBottom: spacing.sm },
  msgRow: { flexDirection: 'row', marginBottom: spacing.md, maxWidth: '85%' },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm, marginTop: spacing.xs },
  avatarText: { fontSize: 14 },
  bubble: { padding: spacing.md, borderRadius: radius.lg, maxWidth: '100%' },
  userBubble: { backgroundColor: colors.primary, borderBottomRightRadius: radius.xs },
  assistantBubble: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.xs, borderWidth: 1, borderColor: colors.border },
  msgText: { fontSize: fontSize.base, color: colors.text, lineHeight: 22 },
  msgTime: { fontSize: fontSize.xs, marginTop: spacing.xs, textAlign: 'right' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, alignSelf: 'flex-start' },
  loadingText: { marginLeft: spacing.sm, fontSize: fontSize.sm, color: colors.textTertiary },
  suggestions: { padding: spacing.lg, paddingTop: 0 },
  suggestionsTitle: { fontSize: fontSize.sm, color: colors.slate500, marginBottom: spacing.sm, fontWeight: fontWeight.medium },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  suggestionChip: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg - 2, paddingVertical: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border },
  suggestionText: { fontSize: fontSize.sm, color: colors.primary },
  inputBar: { flexDirection: 'row', padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: colors.background, borderRadius: radius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, fontSize: fontSize.base, maxHeight: 80, color: colors.text, borderWidth: 1, borderColor: colors.border },
  sendBtn: { marginLeft: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.xl },
  sendText: { color: colors.textInverse, fontWeight: fontWeight.semibold, fontSize: fontSize.sm + 1 },
}), [colors, spacing, radius, fontSize, fontWeight]);
  const [messages, setMessages] = useState<Message[]>([
    { id: '0', role: 'assistant', content: 'Hi! I\'m your financial copilot. Ask me anything about your finances, or try one of the suggestions below.', timestamp: new Date() },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: messageText, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await copilotApi.chat({ message: messageText, session_id: sessionId || undefined });
      setSessionId(res.data.session_id || null);
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.data.response || res.data.message || 'I processed your request.', timestamp: new Date() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: err.response?.data?.detail || 'Sorry, I had trouble connecting. Please try again.', timestamp: new Date() };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.msgList}
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.role === 'user' ? styles.userRow : styles.assistantRow]}>
            {item.role === 'assistant' && <View style={styles.avatar} accessibilityLabel="Assistant"><Text style={styles.avatarText}>🤖</Text></View>}
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.msgText, item.role === 'user' && { color: colors.textInverse }]}>{item.content}</Text>
              <Text style={[styles.msgTime, item.role === 'user' ? { color: colors.primaryLight } : { color: colors.textTertiary }]}>
                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={loading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>Thinking...</Text></View> : null}
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Try asking:</Text>
          <View style={styles.suggestionRow}>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)} accessibilityLabel={s} accessibilityRole="button">
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask about your finances..." placeholderTextColor={colors.textTertiary} multiline maxLength={500} onSubmitEditing={() => sendMessage()} blurOnSubmit accessibilityLabel="Chat input" />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!input.trim() || loading} accessibilityLabel="Send message" accessibilityRole="button">
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

