import { useState, useRef, useEffect, useCallback } from 'react';
import { BarChart3, Bot, Mic, MicOff, PiggyBank, Send, Target, TrendingUp, Volume2, VolumeX } from 'lucide-react';
import toast from 'react-hot-toast';
import { copilotApi, transactionsApi, budgetsApi, goalsApi, billsApi, categoriesApi, accountsApi } from '../services/api';
import { startVoice, getVoiceEngine, type VoiceRecordingHandle } from '../services/voice';
import { speak, cancelSpeech, isTtsSupported, setTtsMuted } from '../utils/tts';
import { cn } from '../utils/format';
import type { ProposedAction } from '../types';
import { ActionConfirmCard } from '../components/ActionConfirmCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const suggestions = [
  { icon: TrendingUp, label: 'Analyze my spending', prompt: 'Analyze my spending this month and give me insights' },
  { icon: PiggyBank, label: 'Budget advice', prompt: 'Give me advice on how to improve my budget' },
  { icon: Target, label: 'Goal planning', prompt: 'Help me plan for my financial goals' },
  { icon: BarChart3, label: 'Monthly review', prompt: 'Give me a monthly financial review' },
];

async function executeAction(action: ProposedAction): Promise<void> {
  switch (action.action_type) {
    case 'create_transaction':
      await transactionsApi.create(action.payload);
      break;
    case 'update_transaction':
      await transactionsApi.update(action.payload.id, action.payload.data);
      break;
    case 'delete_transaction':
      await transactionsApi.delete(action.payload.id);
      break;
    case 'create_budget':
      await budgetsApi.create(action.payload);
      break;
    case 'create_goal':
      await goalsApi.create(action.payload);
      break;
    case 'create_category':
      await categoriesApi.create(action.payload);
      break;
    case 'create_account':
      await accountsApi.create(action.payload);
      break;
    case 'mark_bill_paid':
      await billsApi.update(action.payload.id, action.payload.data);
      break;
    default:
      throw new Error(`Unknown action type: ${action.action_type}`);
  }
}

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m your financial copilot. Ask me anything about your finances—I can help with budgeting, spending analysis, goal planning, and more.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<ProposedAction[]>([]);
  const [voiceMode, setVoiceMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const accumulatedRef = useRef('');
  const recordingRef = useRef<VoiceRecordingHandle | null>(null);

  const micSupported = getVoiceEngine() !== null;
  const ttsSupported = isTtsSupported();

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent, pendingActions]);

  useEffect(() => {
    return () => {
      cancelSpeech();
      recordingRef.current?.cancel();
    };
  }, []);

  const stopRecording = useCallback(async () => {
    const handle = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    if (!handle) return;
    setTranscribing(true);
    try {
      const text = await handle.stop();
      if (text === '__mic_denied__') {
        toast.error('Microphone access denied. Allow mic permission and try again.');
      } else if (!text) {
        toast.error("Sorry, I didn't catch that. Please try again.");
      } else {
        setInput('');
        await sendMessageRef.current(text);
      }
    } catch {
      toast.error('Failed to process your voice. Please try again.');
    } finally {
      setTranscribing(false);
    }
  }, []);

  const toggleRecording = useCallback(async () => {
    if (recording) {
      await stopRecording();
      return;
    }
    try {
      const handle = await startVoice();
      recordingRef.current = handle;
      setRecording(true);
    } catch {
      toast.error('Microphone access denied. Allow mic permission and try again.');
    }
  }, [recording, stopRecording]);

  const handleVoiceModeToggle = useCallback(() => {
    if (!voiceMode && !micSupported) {
      toast.error('Voice input is not supported in this browser.');
      return;
    }
    if (voiceMode && recording) {
      recordingRef.current?.cancel();
      recordingRef.current = null;
      setRecording(false);
    }
    cancelSpeech();
    setVoiceMode((v) => !v);
  }, [voiceMode, micSupported, recording]);

  useEffect(() => {
    setTtsMuted(muted);
  }, [muted]);

  const handleMuteToggle = useCallback(() => {
    setMuted((m) => !m);
    cancelSpeech();
  }, []);

  const onApproveAction = useCallback(async (action: ProposedAction) => {
    await executeAction(action);
    toast.success('Done');
    if (voiceMode) speak(`Done. ${action.summary}`);
  }, [voiceMode]);

  const onRejectAction = useCallback((action: ProposedAction) => {
    setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
    toast('Action discarded');
  }, []);

  const onDoneAction = useCallback((action: ProposedAction) => {
    setPendingActions((prev) => prev.filter((a) => a.id !== action.id));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    cancelSpeech();
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamingContent('');
    accumulatedRef.current = '';

    const payload = {
      message: text,
      session_id: sessionId || undefined,
    };

    let completed = false;
    abortRef.current = copilotApi.chatStream(payload,
      (event) => {
        if (event.type === 'session_id') {
          setSessionId(event.content);
        } else if (event.type === 'status') {
          setStreamingContent(`_${event.content}_`);
        } else if (event.type === 'token') {
          accumulatedRef.current += event.content;
          setStreamingContent(accumulatedRef.current);
        } else if (event.type === 'actions' && Array.isArray(event.content)) {
          setPendingActions((prev) => {
            const existing = new Set(prev.map((a) => a.id));
            const fresh = (event.content as ProposedAction[]).filter((a) => !existing.has(a.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
        } else if (event.type === 'error') {
          setMessages((prev) => [...prev, { role: 'assistant', content: event.content }]);
          setStreamingContent('');
          setLoading(false);
          completed = true;
        } else if (event.type === 'done') {
          setMessages((prev) => {
            if (prev[prev.length - 1]?.role === 'assistant') return prev;
            return [...prev, { role: 'assistant', content: accumulatedRef.current }];
          });
          setStreamingContent('');
          setLoading(false);
          completed = true;
          if (voiceMode && accumulatedRef.current) {
            speak(accumulatedRef.current);
          }
        }
      },
      () => {
        setMessages((prev) => {
          if (prev[prev.length - 1]?.role === 'assistant') return prev;
          return [...prev, { role: 'assistant', content: accumulatedRef.current }];
        });
        setStreamingContent('');
        setLoading(false);
        completed = true;
      },
      () => {
        if (!completed) {
          setMessages((prev) => [...prev, { role: 'assistant', content: "I'm having trouble connecting. Please try again." }]);
          setStreamingContent('');
          setLoading(false);
          completed = true;
        }
      }
    );
  }, [loading, sessionId, voiceMode]);

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  return (
    <section className="page-container h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            AI Financial Copilot
          </h1>
          <p className="page-subtitle">Powered by Ollama Cloud</p>
        </div>
        <div className="flex items-center gap-2">
          {ttsSupported && (
            <button onClick={handleMuteToggle} title={muted ? 'Unmute replies' : 'Mute replies'}
              className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}
          <button onClick={handleVoiceModeToggle} title="Toggle voice mode"
            className={cn('p-2 rounded-xl transition-colors',
              voiceMode ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300')}>
            {voiceMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 card p-4 mb-4 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div className={cn('max-w-[75%] rounded-2xl px-4 py-3', msg.role === 'user' ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-200')}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-surface-900 dark:prose-headings:text-surface-100 prose-strong:text-surface-900 dark:prose-strong:text-surface-100 prose-p:text-surface-700 dark:prose-p:text-surface-300 prose-li:text-surface-700 dark:prose-li:text-surface-300">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-surface-600 dark:text-surface-400">You</span>
              </div>
            )}
          </div>
        ))}
        {pendingActions.length > 0 && (
          <div className="flex flex-col gap-3">
            {pendingActions.map((action) => (
              <ActionConfirmCard key={action.id} action={action}
                onApprove={onApproveAction} onReject={onRejectAction} onDone={onDoneAction} />
            ))}
          </div>
        )}
        {loading && streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl px-4 py-3">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
        {loading && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && !loading && (
        <div className="mb-4">
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.label} onClick={() => sendMessage(s.prompt)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl text-xs font-medium text-surface-600 dark:text-surface-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {voiceMode && (
        <div className="flex items-center gap-2 mb-3 text-xs text-surface-500 dark:text-surface-400">
          <Mic className="w-3.5 h-3.5" />
          Voice mode on — click the mic and speak. Replies will be read aloud.
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask about your finances..."
          className="input-field flex-1"
          disabled={loading}
        />
        {voiceMode && (
          <button
            onClick={toggleRecording}
            disabled={transcribing || loading}
            title={recording ? 'Stop recording' : 'Start recording'}
            className={cn('px-4 rounded-xl transition-colors flex items-center justify-center',
              recording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300')}
          >
            {transcribing ? (
              <div className="w-4 h-4 border-2 border-surface-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Mic className={cn('w-5 h-5', recording && 'animate-pulse')} />
            )}
          </button>
        )}
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="btn-primary px-5">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}