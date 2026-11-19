/** Speech recognition + synthesis helpers. */

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

let voices: SpeechSynthesisVoice[] = [];

function refreshVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const list = window.speechSynthesis.getVoices();
  if (list.length) voices = list;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}

export function recognitionSupported(): boolean {
  return Boolean(
    typeof window !== 'undefined' &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition),
  );
}

export function synthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) refreshVoices();
  if (!voices.length) return null;
  const preferred = [
    'Daniel',
    'Google UK English Male',
    'Microsoft Ryan Online',
    'George',
    'Arthur',
    'Google UK English Female',
    'Microsoft Sonia Online',
  ];
  for (const name of preferred) {
    const found = voices.find((v) => v.name === name);
    if (found) return found;
  }
  const gb = voices.find((v) => v.lang?.startsWith('en-GB'));
  if (gb) return gb;
  return voices.find((v) => v.lang?.startsWith('en')) ?? voices[0];
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function stopSpeaking() {
  if (!synthesisSupported()) return;
  activeUtterance = null;
  window.speechSynthesis.cancel();
}

export function speak(text: string, options: { muted?: boolean; rate?: number } = {}): Promise<void> {
  if (options.muted || !synthesisSupported()) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? 'en-GB';
    utterance.rate = options.rate ?? 1.02;
    utterance.pitch = 0.92;
    utterance.volume = 1;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeUtterance === utterance) activeUtterance = null;
      resolve();
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    // Some browsers never fire onend if the tab is backgrounded.
    const guard = window.setTimeout(finish, Math.max(3500, text.length * 105));
    utterance.onend = () => {
      window.clearTimeout(guard);
      finish();
    };
    activeUtterance = utterance;
    synth.speak(utterance);
  });
}

export interface ListenOptions {
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
}

export function startListening(options: ListenOptions): () => void {
  const Ctor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (!Ctor) {
    options.onError?.('Speech recognition is not available in this browser. Chrome or Edge works best.');
    return () => {};
  }

  const recognition: RecognitionLike = new Ctor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let stopped = false;
  let ended = false;

  const safeEnd = () => {
    if (ended) return;
    ended = true;
    options.onEnd?.();
  };

  recognition.onstart = () => options.onStart?.();

  recognition.onresult = (event: any) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    if (interim) options.onInterim?.(interim);
  };

  recognition.onerror = (event: any) => {
    if (event?.error === 'aborted' || event?.error === 'no-speech') return;
    const map: Record<string, string> = {
      'not-allowed': 'Microphone access was blocked. Allow the mic in your browser and try again.',
      'service-not-allowed': 'Speech service is unavailable in this browser.',
      network: 'The speech service could not be reached.',
      'audio-capture': 'No microphone was detected.',
    };
    options.onError?.(map[event?.error] ?? 'Voice input failed. Try again.');
  };

  const stopRef = {
    current: () => {
      if (stopped) return;
      stopped = true;
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    },
  };

  recognition.onend = () => {
    if (finalText.trim()) options.onFinal(finalText.trim());
    safeEnd();
  };

  try {
    recognition.start();
  } catch {
    options.onError?.('Could not start listening. Give it a moment and try again.');
    return () => {};
  }

  return () => stopRef.current();
}
