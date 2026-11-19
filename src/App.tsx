import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type {
  AccentId,
  DrawerId,
  Message,
  Note,
  ReactorState,
  Role,
  Settings,
  TimerItem,
  WeatherData,
} from './types';
import { QUICK_ACTIONS, interpret, type BrainContext, type Effect } from './lib/brain';
import { loadWeather, timezoneCity } from './lib/weather';
import { startListening, recognitionSupported, speak, stopSpeaking } from './lib/speech';
import {
  alertTone,
  beep,
  bootChord,
  ensureAudio,
  startAmbient,
  stopAmbient,
  successChime,
} from './lib/audio';
import { historyToChat, streamChat } from './lib/ai';
import { useSystemStats } from './hooks/useSystemStats';
import { useLocalStorage, useNow } from './hooks/useLocalStorage';
import { useLocalModel } from './hooks/useLocalModel';
import BootScreen from './components/BootScreen';
import TopBar from './components/TopBar';
import Reactor from './components/Reactor';
import Comms from './components/Comms';
import CommandBar from './components/CommandBar';
import { ClockCard, EnvironmentCard, NotesCard, SystemCard, TimersCard } from './components/Widgets';
import { HelpDrawer, SettingsDrawer } from './components/Drawers';

const DEFAULT_LOCAL_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';

const DEFAULT_SETTINGS: Settings = {
  userName: '',
  callSign: 'sir',
  city: timezoneCity(),
  accent: 'cyan',
  muted: false,
  ambient: false,
  rate: 1.02,
  ai: {
    enabled: false,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    apiKey: '',
  },
  local: {
    enabled: true,
    model: DEFAULT_LOCAL_MODEL,
  },
};

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export default function App() {
  const [settings, setSettings, resetSettings] = useLocalStorage<Settings>('jarvis.settings.v1', DEFAULT_SETTINGS);
  const [messages, setMessages] = useLocalStorage<Message[]>('jarvis.log.v1', []);
  const [notes, setNotes] = useLocalStorage<Note[]>('jarvis.notes.v1', []);
  const [timers, setTimers] = useLocalStorage<TimerItem[]>('jarvis.timers.v1', []);

  const [input, setInput] = useState('');
  const [status, setStatus] = useState<ReactorState>('idle');
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(false);
  const [suitVisible, setSuitVisible] = useState(true);
  const [squad, setSquad] = useState(0);
  const [drawer, setDrawer] = useState<DrawerId>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [booted, setBooted] = useState(false);

  const stats = useSystemStats();
  const now = useNow(1000);
  const micSupported = useMemo(() => recognitionSupported(), []);
  const {
    status: localStatus,
    percent: localPercent,
    device: localDevice,
    error: localError,
    preload: preloadLocal,
    generate: generateLocal,
  } = useLocalModel(settings.local.model);

  const inputRef = useRef<HTMLInputElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>(messages);
  const settingsRef = useRef<Settings>(settings);
  const ctxRef = useRef<BrainContext>({ settings, stats, weather, notes, timers });
  const busyRef = useRef(false);
  const listeningRef = useRef(false);
  const stopListenRef = useRef<(() => void) | null>(null);
  const aiAbortRef = useRef<AbortController | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const runCommandRef = useRef<(text: string) => Promise<void>>(async () => {});

  settingsRef.current = settings;
  messagesRef.current = messages;
  ctxRef.current = { settings, stats, weather, notes, timers };

  const showNotice = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 6500);
  }, []);

  const addMessage = useCallback(
    (role: Role, text: string) => {
      setMessages((prev) => [...prev, { id: uid(), role, text, time: Date.now() }].slice(-120));
    },
    [setMessages],
  );

  const say = useCallback(async (text: string) => {
    const current = settingsRef.current;
    setStatus('speaking');
    await speak(text, { muted: current.muted, rate: current.rate });
    setStatus('idle');
  }, []);

  const applyEffect = useCallback(
    (effect: Effect) => {
      switch (effect.type) {
        case 'accent':
          setSettings((prev) => ({ ...prev, accent: effect.value as AccentId }));
          successChime();
          break;
        case 'alert':
          setAlert(effect.value);
          if (effect.value) alertTone();
          break;
        case 'suit':
          setSuitVisible(effect.value);
          break;
        case 'squad':
          setSquad(effect.count);
          if (effect.count > 0) setSuitVisible(true);
          break;
        case 'timer':
          setTimers((prev) => [
            ...prev,
            {
              id: uid(),
              label: effect.label,
              endsAt: Date.now() + effect.seconds * 1000,
              seconds: effect.seconds,
            },
          ]);
          break;
        case 'cancelTimers':
          setTimers([]);
          break;
        case 'note':
          setNotes((prev) => [{ id: uid(), text: effect.text, createdAt: Date.now() }, ...prev].slice(0, 50));
          successChime();
          break;
        case 'clearNotes':
          setNotes([]);
          break;
        case 'mute':
          setSettings((prev) => ({ ...prev, muted: effect.value }));
          if (effect.value) stopSpeaking();
          break;
        case 'ambient':
          setSettings((prev) => ({ ...prev, ambient: effect.value }));
          break;
        case 'name':
          setSettings((prev) => ({ ...prev, userName: effect.value }));
          break;
        case 'callSign':
          setSettings((prev) => ({ ...prev, callSign: effect.value }));
          break;
        case 'city':
          setSettings((prev) => ({ ...prev, city: effect.value }));
          break;
        case 'fullscreen':
          try {
            if (effect.value && !document.fullscreenElement) void document.documentElement.requestFullscreen?.();
            if (!effect.value && document.fullscreenElement) void document.exitFullscreen();
          } catch {
            /* fullscreen may be blocked */
          }
          break;
        case 'clearLog':
          setMessages([]);
          break;
        case 'openSettings':
          setDrawer('settings');
          break;
        case 'openHelp':
          setDrawer('help');
          break;
        default:
          break;
      }
    },
    [setMessages, setNotes, setSettings, setTimers],
  );

  const runAI = useCallback(
    async (prompt: string) => {
      const current = settingsRef.current;
      const id = uid();
      setMessages((prev) => [...prev, { id, role: 'jarvis', text: '', time: Date.now() }]);
      let buffer = '';
      const controller = new AbortController();
      aiAbortRef.current = controller;

      try {
        const history = historyToChat(messagesRef.current, current.userName)
          .filter((m, index, all) => !(index === all.length - 1 && m.role === 'user' && m.content === prompt))
          .slice(-8);
        const full = await streamChat({
          settings: current,
          messages: [...history, { role: 'user', content: prompt }],
          onDelta: (delta) => {
            buffer += delta;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: buffer } : m)));
          },
          signal: controller.signal,
        });
        if (!full.trim()) throw new Error('The model returned an empty response.');
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: full.trim() } : m)));
        await say(full.trim().slice(0, 700));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown uplink fault.';
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: `Neural link failure — ${message}` } : m)),
        );
        showNotice('AI uplink failed. Verify endpoint, model and key in Settings.');
      } finally {
        if (aiAbortRef.current === controller) aiAbortRef.current = null;
      }
    },
    [say, setMessages, showNotice],
  );

  const runLocal = useCallback(
    async (prompt: string) => {
      const id = uid();
      setMessages((prev) => [...prev, { id, role: 'jarvis', text: '', time: Date.now() }]);
      let buffer = '';
      try {
        const text = await generateLocal(
          [
            {
              role: 'system',
              content:
                'You are J.A.R.V.I.S., a calm, witty AI assistant. Answer in one to three short, confident sentences. No markdown, no lists.',
            },
            { role: 'user', content: prompt },
          ],
          (chunk) => {
            buffer += chunk;
            setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: buffer } : m)));
          },
        );
        const final = text.trim();
        if (!final) throw new Error('The model returned an empty response.');
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: final } : m)));
        await say(final.slice(0, 700));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The on-device model failed.';
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, text: `On-device model unavailable — ${message}` } : m)),
        );
        showNotice('On-device model failed. Open Settings to retry or switch models.');
      }
    },
    [generateLocal, say, setMessages, showNotice],
  );

  const runCommand = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setStatus('thinking');
      ensureAudio();
      beep(720, 0.05, 'sine', 0.022);
      addMessage('user', text);
      setInput('');

      const reply = interpret(text, ctxRef.current);
      if (reply.effect) applyEffect(reply.effect);
      if (reply.url) window.open(reply.url, '_blank', 'noopener,noreferrer');

      try {
        if (reply.weatherCity) {
          setWeatherLoading(true);
          setWeatherError(null);
          try {
            const data = await loadWeather(reply.weatherCity);
            setWeather(data);
            const line = `${data.city}: ${data.desc.toLowerCase()}, ${data.tempC} degrees Celsius, feels like ${data.feelsC}. Humidity ${data.humidity} percent, wind ${data.windKph} kilometres per hour.`;
            addMessage('jarvis', line);
            await say(line);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Weather uplink failed.';
            setWeatherError(message);
            addMessage('jarvis', `${message} I will retain the last readings on screen.`);
            await say(message);
          } finally {
            setWeatherLoading(false);
          }
        } else if (reply.ai) {
          await runAI(text);
        } else if (reply.local) {
          await runLocal(text);
        } else {
          await sleep(260 + Math.min(520, reply.speech.length * 3));
          addMessage('jarvis', reply.speech);
          await say(reply.speech);
        }
      } finally {
        setBusy(false);
        busyRef.current = false;
        setStatus('idle');
      }
    },
    [addMessage, applyEffect, runAI, runLocal, say],
  );

  runCommandRef.current = runCommand;

  const toggleMic = useCallback(() => {
    if (listeningRef.current) {
      stopListenRef.current?.();
      return;
    }
    ensureAudio();
    stopSpeaking();
    setTranscript('');
    setListening(true);
    listeningRef.current = true;
    setStatus('listening');
    beep(520, 0.06, 'sine', 0.02);

    stopListenRef.current = startListening({
      onInterim: (text) => setTranscript(text),
      onFinal: (text) => {
        setTranscript('');
        void runCommandRef.current(text);
      },
      onEnd: () => {
        setListening(false);
        listeningRef.current = false;
        setTranscript('');
        setStatus((prev) => (prev === 'listening' ? 'idle' : prev));
      },
      onError: (message) => {
        setListening(false);
        listeningRef.current = false;
        setStatus('idle');
        addMessage('system', message);
        showNotice(message);
      },
    });
  }, [addMessage, showNotice]);

  /* ------------------------------------------------- boot / welcome */
  useEffect(() => {
    bootChord();
    setMessages((prev) =>
      prev.length
        ? prev
        : [
            {
              id: 'welcome',
              role: 'jarvis',
              text: `Interface online. I am J.A.R.V.I.S.${
                settingsRef.current.callSign ? ` At your service, ${settingsRef.current.callSign}.` : ''
              } Press the microphone or type a command — say “help” for the full protocol list.`,
              time: Date.now(),
            },
          ],
    );
  }, [setMessages]);

  // Surface one-time model download progress inside the conversation.
  useEffect(() => {
    if (localStatus !== 'loading') return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== 'jarvis') return prev;
      if (last.text && !last.text.startsWith('On-device model loading')) return prev;
      return [
        ...prev.slice(0, -1),
        { ...last, text: `On-device model loading… ${localPercent}% · first run only, cached afterwards.` },
      ];
    });
  }, [localPercent, localStatus, setMessages]);

  useEffect(() => {
    let cancelled = false;
    setWeatherLoading(true);
    loadWeather(settingsRef.current.city)
      .then((data) => {
        if (!cancelled) setWeather(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) setWeatherError(error instanceof Error ? error.message : 'Weather unavailable.');
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------------------------------------------------ audio bus */
  useEffect(() => {
    if (settings.ambient) startAmbient();
    else stopAmbient();
  }, [settings.ambient]);

  useEffect(() => {
    const resume = () => {
      ensureAudio();
      if (settingsRef.current.ambient) startAmbient();
    };
    window.addEventListener('pointerdown', resume, { once: true });
    return () => window.removeEventListener('pointerdown', resume);
  }, []);

  useEffect(() => {
    if (settings.muted) {
      stopSpeaking();
      setStatus((prev) => (prev === 'speaking' ? 'idle' : prev));
    }
  }, [settings.muted]);

  /* ------------------------------------------------------- timers */
  useEffect(() => {
    if (!timers.length) return;
    const handle = window.setInterval(() => {
      const nowMs = Date.now();
      const done = timers.filter((timer) => timer.endsAt <= nowMs);
      if (!done.length) return;
      setTimers((prev) => prev.filter((timer) => timer.endsAt > nowMs));
      const label = done.map((timer) => timer.label).join(' and ');
      addMessage('system', `Timer complete — ${label}`);
      alertTone();
      const current = settingsRef.current;
      const line = `Time's up${current.callSign ? `, ${current.callSign}` : ''}. ${label} complete.`;
      setStatus('speaking');
      void speak(line, { muted: current.muted, rate: current.rate }).then(() => setStatus('idle'));
    }, 500);
    return () => window.clearInterval(handle);
  }, [addMessage, setTimers, timers]);

  /* ---------------------------------------------------- shortcuts */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === 'Escape') {
        setDrawer(null);
        if (listeningRef.current) {
          stopListenRef.current?.();
        }
        return;
      }
      if (typing) return;
      if (event.key === '/') {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        toggleMic();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleMic]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      aiAbortRef.current?.abort();
      stopSpeaking();
      stopAmbient();
    };
  }, []);

  /* ------------------------------------------------------- actions */
  const toggleFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen?.();
    } catch {
      /* blocked */
    }
    beep(600, 0.05);
  }, []);

  const handlePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = glowRef.current;
    if (!node) return;
    node.style.transform = `translate3d(${event.clientX - 320}px, ${event.clientY - 320}px, 0)`;
  };

  const refreshWeather = () => {
    setWeatherLoading(true);
    setWeatherError(null);
    loadWeather(settingsRef.current.city)
      .then(setWeather)
      .catch((error: unknown) => setWeatherError(error instanceof Error ? error.message : 'Weather unavailable.'))
      .finally(() => setWeatherLoading(false));
  };

  const clearLog = () => {
    setMessages([]);
    beep(420, 0.06);
  };

  const addNote = (text: string) => {
    setNotes((prev) => [{ id: uid(), text, createdAt: Date.now() }, ...prev].slice(0, 50));
    successChime();
  };

  const statusLine =
    status === 'listening'
      ? 'Listening. Speak your command.'
      : status === 'thinking'
        ? 'Processing your request…'
        : status === 'speaking'
          ? 'Transmitting response.'
          : 'All systems online · awaiting your instruction';

  const greetingPart =
    now.getHours() < 5 ? 'evening' : now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';

  const aiReady = settings.ai.enabled && Boolean(settings.ai.apiKey);
  const fpsLabel = document.hidden ? 'PAUSED' : `${stats.fps} FPS`;

  return (
    <div
      className={`app ${alert ? 'is-alert' : ''}`}
      data-accent={settings.accent}
      onPointerMove={handlePointer}
    >
      <div className="bg-grid" aria-hidden="true" />
      <div className="bg-aurora" aria-hidden="true" />
      <div className="bg-scan" aria-hidden="true" />
      <div className="bg-vignette" aria-hidden="true" />
      <div className="cursor-glow" ref={glowRef} aria-hidden="true" />
      {alert && <div className="alert-veil" aria-hidden="true" />}

      <TopBar
        settings={settings}
        stats={stats}
        now={now}
        onSettings={() => setDrawer('settings')}
        onHelp={() => setDrawer('help')}
        onToggleMute={() => {
          setSettings((prev) => ({ ...prev, muted: !prev.muted }));
          beep(560, 0.05);
        }}
        onToggleAmbient={() => {
          ensureAudio();
          setSettings((prev) => ({ ...prev, ambient: !prev.ambient }));
        }}
        onFullscreen={toggleFullscreen}
        localEnabled={settings.local.enabled}
      />

      <main className="stage">
        <aside className="rail rail-left">
          <ClockCard now={now} />
          <EnvironmentCard
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            onRefresh={refreshWeather}
          />
          <SystemCard stats={stats} />
        </aside>

        <section className="core-stage" aria-label="Assistant core">
          <div className="core-topline">
            <span>ARC INTERFACE · MARK VII</span>
            <span className="core-topline-right">
              <i className={`live-dot ${stats.online ? 'on' : 'off'}`} />
              {stats.online ? 'SECURE CHANNEL' : 'CHANNEL LOST'}
            </span>
          </div>

          <Reactor state={status} suitVisible={suitVisible} squad={squad} />

          <div className="core-caption">
            <p className="core-address">
              Good {greetingPart}
              {settings.callSign ? `, ${settings.callSign}` : ''}. <span>{statusLine}</span>
            </p>
            <p className="core-sub">
              {listening ? 'Microphone live — speak naturally' : 'Speak, or select a protocol below'}
            </p>
          </div>

          <div className="quick-actions">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.command}
                type="button"
                className="quick-action"
                onClick={() => void runCommand(action.command)}
              >
                <span className="quick-action-dot" />
                {action.label}
              </button>
            ))}
          </div>

          <div className="core-telemetry">
            <div>
              <span>FRAME RATE</span>
              <b>{fpsLabel}</b>
            </div>
            <div>
              <span>UPLINK</span>
              <b>{stats.online ? 'STABLE' : 'DOWN'}</b>
            </div>
            <div>
              <span>SESSION</span>
              <b>
                {String(Math.floor(stats.uptime / 60)).padStart(2, '0')}:
                {String(stats.uptime % 60).padStart(2, '0')}
              </b>
            </div>
            <div>
              <span>NEURAL</span>
              <b>
                {aiReady
                  ? 'LINKED'
                  : localStatus === 'ready'
                    ? 'ON-DEVICE'
                    : settings.local.enabled
                      ? 'STANDBY'
                      : 'LOCAL'}
              </b>
            </div>
          </div>
        </section>

        <aside className="rail rail-right">
          <Comms
            messages={messages}
            thinking={busy && status === 'thinking'}
            transcript={transcript}
            listening={listening}
            onClear={clearLog}
          />
          <NotesCard
            notes={notes}
            onAdd={addNote}
            onRemove={(id) => setNotes((prev) => prev.filter((note) => note.id !== id))}
            onClear={() => setNotes([])}
          />
          <TimersCard timers={timers} onCancel={(id) => setTimers((prev) => prev.filter((t) => t.id !== id))} />
        </aside>
      </main>

      <CommandBar
        ref={inputRef}
        value={input}
        onChange={setInput}
        onSubmit={(value) => void runCommand(value)}
        onMic={toggleMic}
        listening={listening}
        micSupported={micSupported}
        muted={settings.muted}
        onToggleMute={() => {
          setSettings((prev) => ({ ...prev, muted: !prev.muted }));
          beep(560, 0.05);
        }}
        busy={busy}
        chips={[
          { label: 'System check', command: 'run diagnostics' },
          { label: 'Weather in Tokyo', command: 'weather in Tokyo' },
          { label: 'Timer · 5 min', command: 'set a timer for 5 minutes' },
          { label: 'Tell me a joke', command: 'tell me a joke' },
        ]}
        notice={localStatus === 'loading' ? `Loading on-device model ${localPercent}%…` : notice}
      />

      <SettingsDrawer
        open={drawer === 'settings'}
        onClose={() => setDrawer(null)}
        settings={settings}
        onChange={setSettings}
        onReset={() => {
          resetSettings();
          showNotice('Configuration restored to defaults.');
        }}
        localStatus={localStatus}
        localPercent={localPercent}
        localDevice={localDevice}
        localError={localError}
        suitVisible={suitVisible}
        onToggleSuit={() => setSuitVisible((visible) => !visible)}
        onPreloadModel={() => {
          void preloadLocal().catch(() => {
            showNotice('Could not load the on-device model. Check your connection and retry.');
          });
        }}
      />
      <HelpDrawer open={drawer === 'help'} onClose={() => setDrawer(null)} />

      {!booted && <BootScreen callSign={settings.callSign} onDone={() => setBooted(true)} />}
    </div>
  );
}
