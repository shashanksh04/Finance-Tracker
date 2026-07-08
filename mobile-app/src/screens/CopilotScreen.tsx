import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { copilotApi } from '../services/api';

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
            {item.role === 'assistant' && <View style={styles.avatar}><Text style={styles.avatarText}>🤖</Text></View>}
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.msgText, item.role === 'user' && { color: '#fff' }]}>{item.content}</Text>
              <Text style={[styles.msgTime, item.role === 'user' ? { color: '#93c5fd' } : { color: '#94a3b8' }]}>
                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
        ListFooterComponent={loading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color="#0284c7" /><Text style={styles.loadingText}>Thinking...</Text></View> : null}
      />

      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsTitle}>Try asking:</Text>
          <View style={styles.suggestionRow}>
            {SUGGESTIONS.map((s, i) => (
              <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(s)}>
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TextInput style={styles.input} value={input} onChangeText={setInput} placeholder="Ask about your finances..." placeholderTextColor="#94a3b8" multiline maxLength={500} onSubmitEditing={() => sendMessage()} blurOnSubmit />
        <TouchableOpacity style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]} onPress={() => sendMessage()} disabled={!input.trim() || loading}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  msgList: { padding: 16, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', marginBottom: 12, maxWidth: '85%' },
  userRow: { alignSelf: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginTop: 4 },
  avatarText: { fontSize: 14 },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '100%' },
  userBubble: { backgroundColor: '#0284c7', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#e2e8f0' },
  msgText: { fontSize: 15, color: '#0f172a', lineHeight: 22 },
  msgTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, alignSelf: 'flex-start' },
  loadingText: { marginLeft: 8, fontSize: 13, color: '#94a3b8' },
  suggestions: { padding: 16, paddingTop: 0 },
  suggestionsTitle: { fontSize: 13, color: '#64748b', marginBottom: 8, fontWeight: '500' },
  suggestionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  suggestionText: { fontSize: 13, color: '#0284c7' },
  inputBar: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 80, color: '#0f172a', borderWidth: 1, borderColor: '#e2e8f0' },
  sendBtn: { marginLeft: 8, backgroundColor: '#0284c7', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  sendText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
