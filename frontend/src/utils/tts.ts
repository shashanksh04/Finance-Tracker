let muted = false;

export function setTtsMuted(value: boolean) {
  muted = value;
}

export function isTtsMuted(): boolean {
  return muted;
}

export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*+]\s*/gm, '')
    .replace(/^>\s*/gm, '')
    .replace(/\|/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export function speak(text: string) {
  if (muted || !isTtsSupported()) return;
  const clean = stripMarkdown(text);
  if (!clean) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && v.localService) ||
    voices.find((v) => v.lang?.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech() {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}