import { voiceApi } from './api';

export type VoiceEngine = 'backend' | 'browser';

export interface VoiceRecordingHandle {
  stop: () => Promise<string | null>;
  cancel: () => void;
}

export function getVoiceEngine(): VoiceEngine | null {
  if (typeof window === 'undefined') return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (SR) return 'browser';
  if ((navigator as any).mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined') {
    return 'backend';
  }
  return null;
}

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  const MediaRecorderCtor = (window as any).MediaRecorder as {
    isTypeSupported: (t: string) => boolean;
  };
  for (const type of candidates) {
    if (MediaRecorderCtor.isTypeSupported(type)) return type;
  }
  return undefined;
}

function extFromMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

async function transcribeAudio(blob: Blob): Promise<string> {
  const file = new File([blob], `voice-${Date.now()}.${extFromMime(blob.type)}`, {
    type: blob.type,
  });
  const res = await voiceApi.transcribe(file);
  const text = res.data?.text || '';
  if (!text) throw new Error('No speech detected');
  return text;
}

async function startBackendRecording(): Promise<VoiceRecordingHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  recorder.start();

  const stopPromise = new Promise<Blob | null>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!chunks.length) {
        resolve(null);
        return;
      }
      resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
    };
  });

  return {
    stop: async () => {
      if (recorder.state !== 'inactive') recorder.stop();
      const blob = await stopPromise;
      if (!blob) return null;
      try {
        return await transcribeAudio(blob);
      } catch (err: any) {
        if (err?.message === 'No speech detected') return null;
        throw err;
      }
    },
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.onstop = null;
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

function startBrowserRecognition(): VoiceRecordingHandle {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let transcript = '';
  let pendingResolve: ((text: string | null) => void) | null = null;

  recognition.onresult = (e: any) => {
    let text = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) text += e.results[i][0].transcript;
    }
    transcript = text;
  };

  recognition.onend = () => {
    const resolver = pendingResolve;
    pendingResolve = null;
    if (resolver) {
      resolver(transcript.trim() || null);
    }
  };

  recognition.onerror = (e: any) => {
    const resolver = pendingResolve;
    pendingResolve = null;
    if (resolver) {
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        resolver('__mic_denied__');
      } else {
        resolver(null);
      }
    }
  };

  recognition.start();

  return {
    stop: () => {
      const promise = new Promise<string | null>((resolve) => {
        pendingResolve = resolve;
      });
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
      return promise;
    },
    cancel: () => {
      try {
        if (recognition?.abort) recognition.abort();
        else recognition.stop();
      } catch {
        // ignore
      }
    },
  };
}

export async function startVoice(): Promise<VoiceRecordingHandle> {
  const engine = getVoiceEngine();
  if (engine === 'browser') return startBrowserRecognition();
  return startBackendRecording();
}