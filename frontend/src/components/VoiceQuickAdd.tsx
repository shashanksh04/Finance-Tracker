import React, { useState, useEffect } from 'react';
import { Mic, X, Check, AlertCircle } from 'lucide-react';
import { voiceApi, transactionsApi } from '../services/api';
import { toast } from 'react-hot-toast';
import { TransactionCreate } from '../types';

export function VoiceQuickAdd({ onClose }: { onClose: () => void }) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedTx, setParsedTx] = useState<TransactionCreate | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startRecording = async () => {
    try {
      setRecording(true);
      setError(null);
      setParsedTx(null);
      
      // Use browser's MediaRecorder
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await uploadAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      
      // Auto-stop after 8 seconds or manual stop
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 8000);

      // Expose the stop function to the window or state
      (window as any).currentVoiceRecorder = mediaRecorder;
    } catch (err) {
      setError("Microphone access denied");
      setRecording(false);
    }
  };

  const stopRecording = () => {
    const recorder = (window as any).currentVoiceRecorder;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    setRecording(false);
  };

  const uploadAudio = async (blob: Blob) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', blob, 'voice_tx.webm');

    try {
      const { data } = await voiceApi.quickAdd(formData);
      setTranscript(data.text);
      setParsedTx(data.parsed_transaction);
    } catch (err) {
      setError("Could not parse your request. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const confirmTransaction = async () => {
    if (!parsedTx) return;
    setLoading(true);
    try {
      await transactionsApi.create(parsedTx);
      toast.success("Transaction added successfully!");
      onClose();
    } catch (err) {
      toast.error("Failed to save transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-surface-900 w-full max-w-md rounded-3xl shadow-2xl border border-surface-200 dark:border-surface-700 p-6 animate-scale-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-100">Voice Entry</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full">
            <X className="w-5 h-5 text-surface-500" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg",
              recording 
                ? "bg-red-500 text-white scale-110 animate-pulse" 
                : "bg-primary-500 text-white hover:bg-primary-600"
            )}
          >
            {recording ? <div className="w-6 h-6 bg-white rounded-sm" /> : <Mic className="w-8 h-8" />}
          </button>
          
          <p className="text-sm text-center text-surface-500 dark:text-surface-400">
            {recording ? "Listening... say 'Spent $10 on coffee'" : "Tap the mic to record your transaction"}
          </p>

          {loading && <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {parsedTx && (
            <div className="w-full p-4 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 animate-fade-in">
              <div className="mb-3">
                <p className="text-xs font-medium text-surface-400 uppercase tracking-wider mb-1">Transcript</p>
                <p className="text-sm italic text-surface-700 dark:text-surface-300">"{transcript}"</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Amount</p>
                  <p className="text-lg font-bold text-surface-900 dark:text-surface-100">{parsedTx.amount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Type</p>
                  <p className={`text-lg font-bold ${parsedTx.type === 'income' ? 'text-emerald-500' : 'text-surface-900 dark:text-surface-100'}`}>
                    {parsedTx.type === 'income' ? 'Income' : 'Expense'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Merchant</p>
                  <p className="text-base font-semibold text-surface-900 dark:text-surface-100 truncate">{parsedTx.merchant || 'Auto-detected'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-surface-400 uppercase tracking-wider">Category</p>
                  <p className="text-base font-semibold text-surface-900 dark:text-surface-100">
                    {parsedTx.category_id ? 'Auto-categorized' : 'Uncategorized'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setParsedTx(null)} 
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                >
                  Edit
                </button>
                <button 
                  onClick={confirmTransaction} 
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" /> Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
