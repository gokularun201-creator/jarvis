import type { Message, Settings } from '../types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildSystemPrompt(settings: Settings): string {
  const address = settings.callSign ? `"${settings.callSign}"` : 'the user';
  return [
    'You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a composed, witty, hyper-competent AI assistant in the style of Tony Stark\'s interface.',
    `Address the user as ${address}. Address them sparingly, not in every sentence.`,
    'Keep spoken replies concise: usually 1-3 sentences, under 60 words unless asked for detail.',
    'Be dry, precise and quietly confident. Never roleplay physical actions or claim to control real hardware.',
    'You can answer questions, explain ideas, do arithmetic, draft short text, plan tasks and brainstorm.',
    'Do not use markdown headings or bullet lists; this is spoken aloud.',
    `The user's display name is ${settings.userName || 'unknown'}.`,
  ].join(' ');
}

export function historyToChat(messages: Message[], userName: string): ChatMessage[] {
  return messages
    .filter((m) => m.role !== 'system')
    .slice(-10)
    .map((m) => ({
      role: m.role === 'jarvis' ? 'assistant' : 'user',
      content: m.role === 'user' ? m.text : m.text,
    }));
}

export interface StreamOptions {
  settings: Settings;
  messages: ChatMessage[];
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({ settings, messages, onDelta, signal }: StreamOptions): Promise<string> {
  const { endpoint, model, apiKey } = settings.ai;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.7,
      max_tokens: 500,
      messages: [{ role: 'system', content: buildSystemPrompt(settings) }, ...messages],
    }),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.text();
      detail = body.slice(0, 220);
    } catch {
      /* ignore */
    }
    throw new Error(`AI uplink rejected (${res.status}). ${detail}`.trim());
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!res.body || !contentType.includes('event-stream')) {
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    if (text) onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          /* partial frame, ignore */
        }
      }
    }
  }
  return full;
}
