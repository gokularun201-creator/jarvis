/**
 * On-device language model worker.
 * Runs a small instruct model with Transformers.js on WebGPU when available,
 * falling back to WASM. Model weights are cached by the browser after the
 * first download, so J.A.R.V.I.S. can then answer with no network and no keys.
 */
import { pipeline, TextStreamer, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const ctx = self as unknown as {
  postMessage: (message: unknown) => void;
  addEventListener: (type: 'message', listener: (event: MessageEvent) => void) => void;
};

let generator: any = null;
let loadedModel = '';
let loadedDevice = '';
const fileProgress = new Map<string, { loaded: number; total: number }>();

function reportProgress() {
  let loaded = 0;
  let total = 0;
  fileProgress.forEach((entry) => {
    loaded += entry.loaded;
    total += entry.total;
  });
  ctx.postMessage({ type: 'progress', percent: total ? Math.round((loaded / total) * 100) : 0 });
}

async function loadModel(model: string) {
  if (generator && loadedModel === model) {
    ctx.postMessage({ type: 'ready', model, device: loadedDevice, cached: true });
    return;
  }

  const device = (navigator as any).gpu ? 'webgpu' : 'wasm';
  ctx.postMessage({ type: 'state', state: 'loading', device });
  fileProgress.clear();

  try {
    generator = await pipeline('text-generation', model, {
      dtype: 'q4',
      device,
      progress_callback: (info: any) => {
        if (info?.status === 'progress' && info.file) {
          fileProgress.set(info.file, { loaded: info.loaded ?? 0, total: info.total ?? 0 });
          reportProgress();
        } else if (info?.status === 'ready') {
          ctx.postMessage({ type: 'progress', percent: 100 });
        }
      },
    });
    loadedModel = model;
    loadedDevice = device;
    ctx.postMessage({ type: 'ready', model, device });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    generator = null;
    loadedModel = '';
    ctx.postMessage({ type: 'error', scope: 'load', message });
  }
}

async function generate(id: string, messages: ChatMessage[], maxNewTokens: number) {
  if (!generator) {
    ctx.postMessage({ type: 'error', scope: 'generate', id, message: 'The on-device model is not loaded.' });
    return;
  }

  try {
    let text = '';
    const streamer = new TextStreamer(generator.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (chunk: string) => {
        text += chunk;
        ctx.postMessage({ type: 'delta', id, text: chunk });
      },
    });

    await generator(messages, {
      max_new_tokens: maxNewTokens,
      do_sample: true,
      temperature: 0.6,
      top_p: 0.9,
      repetition_penalty: 1.05,
      streamer,
    });

    ctx.postMessage({ type: 'done', id, text: text.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.postMessage({ type: 'error', scope: 'generate', id, message });
  }
}

ctx.addEventListener('message', (event: MessageEvent) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'load') void loadModel(String(data.model));
  if (data.type === 'generate') void generate(String(data.id), data.messages, Number(data.maxNewTokens) || 110);
});
