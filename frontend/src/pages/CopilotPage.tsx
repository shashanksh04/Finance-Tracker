import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Send, TrendingUp, PiggyBank, Target, BarChart3 } from 'lucide-react';
import { copilotApi } from '../services/api';
import { cn } from '../utils/format';
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

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I\'m your financial copilot. Ask me anything about your finances—I can help with budgeting, spending analysis, goal planning, and more.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<{ abort: () => void } | null>(null);
  const accumulatedRef = useRef('');

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streamingContent]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
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
        } else if (event.type === 'error') {
          setMessages((prev) => [...prev, { role: 'assistant', content: event.content }]);
          setStreamingContent('');
          completed = true;
        } else if (event.type === 'done') {
          setMessages((prev) => {
            if (prev[prev.length - 1]?.role === 'assistant') return prev;
            return [...prev, { role: 'assistant', content: accumulatedRef.current }];
          });
          setStreamingContent('');
          setLoading(false);
          completed = true;
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
  }, [loading, sessionId]);

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
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="btn-primary px-5">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}
