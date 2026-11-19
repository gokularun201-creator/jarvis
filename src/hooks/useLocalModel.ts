import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../lib/ai';

export type LocalModelStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PendingGeneration {
  onDelta: (text: string) => void;
  resolve: (text: string) => void;
  reject: (error: Error) => void;
}

/**
 * Client for the in-browser model worker. The worker only spins up when the
 * model is actually needed, so the page stays light for command-only use.
 */
export function useLocalModel(model: string) {
  const [status, setStatus] = useState<LocalModelStatus>('idle');
  const [percent, setPercent] = useState(0);
  const [device, setDevice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef<LocalModelStatus>('idle');
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<string, PendingGeneration>());
  const loader = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const counter = useRef(0);
  const modelRef = useRef(model);
  modelRef.current = model;

  const handleRef = useRef<(data: any) => void>(() => {});
  handleRef.current = (data: any) => {
    switch (data?.type) {
      case 'state':
        if (data.state === 'loading') {
          setStatus('loading');
          setPercent(0);
        }
        break;
      case 'progress':
        setPercent(Math.max(0, Math.min(100, Number(data.percent) || 0)));
        break;
      case 'ready':
        setStatus('ready');
        setPercent(100);
        setDevice(data.device ?? null);
        setError(null);
        loader.current?.resolve();
        loader.current = null;
        break;
      case 'delta': {
        const pendingGeneration = pending.current.get(data.id);
        pendingGeneration?.onDelta(String(data.text ?? ''));
        break;
      }
      case 'done': {
        const pendingGeneration = pending.current.get(data.id);
        if (pendingGeneration) {
          pending.current.delete(data.id);
          pendingGeneration.resolve(String(data.text ?? ''));
        }
        break;
      }
      case 'error': {
        const message = String(data.message ?? 'On-device model failed.');
        if (data.scope === 'load') {
          setStatus('error');
          setError(message);
          loader.current?.reject(new Error(message));
          loader.current = null;
        } else {
          const pendingGeneration = data.id ? pending.current.get(data.id) : undefined;
          if (pendingGeneration) {
            pending.current.delete(data.id);
            pendingGeneration.reject(new Error(message));
          }
        }
        break;
      }
      default:
        break;
    }
  };

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const worker = new Worker(new URL('../lib/llm.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent) => handleRef.current(event.data);
    worker.onerror = (event) => {
      const message = event.message || 'The on-device model worker crashed.';
      setStatus('error');
      setError(message);
      loader.current?.reject(new Error(message));
      loader.current = null;
    };
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Free the loaded weights if the operator switches models.
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pending.current.clear();
      loader.current = null;
      setStatus('idle');
      setPercent(0);
      setDevice(null);
    };
  }, [model]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const preload = useCallback(async () => {
    if (statusRef.current === 'ready') return;
    setStatus('loading');
    setError(null);
    setPercent(0);
    const worker = ensureWorker();
    await new Promise<void>((resolve, reject) => {
      loader.current = { resolve, reject };
      worker.postMessage({ type: 'load', model: modelRef.current });
    });
  }, [ensureWorker]);

  const generate = useCallback(
    async (messages: ChatMessage[], onDelta: (text: string) => void): Promise<string> => {
      await preload();
      const worker = workerRef.current;
      if (!worker) throw new Error('The on-device model is unavailable.');
      const id = `local-${++counter.current}`;
      return new Promise<string>((resolve, reject) => {
        pending.current.set(id, { onDelta, resolve, reject });
        worker.postMessage({ type: 'generate', id, messages, maxNewTokens: 120 });
      });
    },
    [preload],
  );

  return { status, percent, device, error, preload, generate };
}
