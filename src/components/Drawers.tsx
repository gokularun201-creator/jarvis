import type { CSSProperties, ReactNode } from 'react';
import type { AccentId, Settings } from '../types';
import type { LocalModelStatus } from '../hooks/useLocalModel';
import { HELP_GROUPS } from '../lib/brain';
import { CloseIcon, Field, Toggle } from './ui';

export const LOCAL_MODELS = [
  { id: 'onnx-community/Qwen2.5-0.5B-Instruct', label: 'Qwen2.5 · 0.5B · balanced (~400 MB)' },
  { id: 'onnx-community/SmolLM2-135M-Instruct-ONNX-MHA', label: 'SmolLM2 · 135M · fastest (~110 MB)' },
];

const ACCENTS: { id: AccentId; label: string; color: string }[] = [
  { id: 'cyan', label: 'Reactor cyan', color: '#38e8ff' },
  { id: 'gold', label: 'Stark gold', color: '#ffc46b' },
  { id: 'crimson', label: 'Crimson alert', color: '#ff5d6c' },
  { id: 'emerald', label: 'Emerald core', color: '#45ffb0' },
  { id: 'violet', label: 'Violet lattice', color: '#b18bff' },
];

function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className={`drawer-veil ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open} aria-label={title}>
        <div className="drawer-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close panel">
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  settings,
  onChange,
  onReset,
  localStatus,
  localPercent,
  localDevice,
  localError,
  onPreloadModel,
  suitVisible,
  onToggleSuit,
}: {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (next: Settings) => void;
  onReset: () => void;
  localStatus: LocalModelStatus;
  localPercent: number;
  localDevice: string | null;
  localError: string | null;
  onPreloadModel: () => void;
  suitVisible: boolean;
  onToggleSuit: () => void;
}) {
  const patch = (part: Partial<Settings>) => onChange({ ...settings, ...part });
  const patchAI = (part: Partial<Settings['ai']>) => onChange({ ...settings, ai: { ...settings.ai, ...part } });
  const patchLocal = (part: Partial<Settings['local']>) =>
    onChange({ ...settings, local: { ...settings.local, ...part } });
  const localStatusLabel =
    localStatus === 'ready'
      ? `READY · ${(localDevice ?? 'cpu').toUpperCase()}`
      : localStatus === 'loading'
        ? `LOADING ${localPercent}%`
        : localStatus === 'error'
          ? 'ERROR'
          : 'NOT LOADED';

  return (
    <Drawer open={open} onClose={onClose} title="CONFIGURATION" subtitle="IDENTITY · APPEARANCE · NEURAL LINK">
      <section className="setting-group">
        <h3>IDENTITY</h3>
        <Field label="Display name">
          <input
            value={settings.userName}
            onChange={(event) => patch({ userName: event.target.value })}
            placeholder="Operator"
            maxLength={40}
          />
        </Field>
        <Field label="Preferred form of address" hint="How J.A.R.V.I.S. addresses you out loud.">
          <input
            value={settings.callSign}
            onChange={(event) => patch({ callSign: event.target.value })}
            placeholder="sir"
            maxLength={24}
          />
        </Field>
        <Field label="Weather station city">
          <input
            value={settings.city}
            onChange={(event) => patch({ city: event.target.value })}
            placeholder="Chennai"
            maxLength={60}
          />
        </Field>
      </section>

      <section className="setting-group">
        <h3>APPEARANCE</h3>
        <span className="field-label">Interface accent</span>
        <div className="swatches">
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              className={`swatch ${settings.accent === accent.id ? 'active' : ''}`}
              style={{ '--sw': accent.color } as CSSProperties}
              onClick={() => patch({ accent: accent.id })}
              aria-label={accent.label}
              aria-pressed={settings.accent === accent.id}
              title={accent.label}
            />
          ))}
        </div>
        <div className="setting-row">
          <span>Ambient reactor audio</span>
          <Toggle checked={settings.ambient} onChange={(ambient) => patch({ ambient })} label="Ambient audio" />
        </div>
        <div className="setting-row">
          <span>Spoken replies</span>
          <Toggle checked={!settings.muted} onChange={(on) => patch({ muted: !on })} label="Spoken replies" />
        </div>
        <div className="setting-row">
          <span>Mark VII armour in the core</span>
          <Toggle checked={suitVisible} onChange={onToggleSuit} label="Iron Man armour" />
        </div>
        <Field label={`Speech rate · ${settings.rate.toFixed(2)}×`}>
          <input
            type="range"
            min={0.7}
            max={1.3}
            step={0.02}
            value={settings.rate}
            onChange={(event) => patch({ rate: Number(event.target.value) })}
          />
        </Field>
      </section>

      <section className="setting-group">
        <h3>NEURAL LINK · OPTIONAL</h3>
        <div className="setting-row">
          <span>Connect external model</span>
          <Toggle checked={settings.ai.enabled} onChange={(enabled) => patchAI({ enabled })} label="External AI model" />
        </div>
        <p className="setting-note">
          Without a model, J.A.R.V.I.S. runs entirely on local command protocols. Connect any
          OpenAI-compatible endpoint to unlock open-ended conversation. The key is stored only in this
          browser and sent directly to the endpoint you name.
        </p>
        <Field label="Chat completions endpoint">
          <input
            value={settings.ai.endpoint}
            onChange={(event) => patchAI({ endpoint: event.target.value })}
            placeholder="https://api.openai.com/v1/chat/completions"
            spellCheck={false}
          />
        </Field>
        <Field label="Model identifier">
          <input
            value={settings.ai.model}
            onChange={(event) => patchAI({ model: event.target.value })}
            placeholder="gpt-4o-mini"
            spellCheck={false}
          />
        </Field>
        <Field label="API key" hint="Never leaves this machine except to call your chosen endpoint.">
          <input
            type="password"
            value={settings.ai.apiKey}
            onChange={(event) => patchAI({ apiKey: event.target.value })}
            placeholder="sk-…"
            autoComplete="off"
            spellCheck={false}
          />
        </Field>
      </section>

      <section className="setting-group">
        <h3>ON-DEVICE MODEL · NO KEY</h3>
        <div className="setting-row">
          <span>Run a model in this browser</span>
          <Toggle
            checked={settings.local.enabled}
            onChange={(enabled) => patchLocal({ enabled })}
            label="On-device model"
          />
        </div>
        <p className="setting-note">
          A small open model runs locally on WebGPU, with a CPU fallback. The weights download once and
          are cached by the browser — after that it answers with no server, no key and no network.
        </p>
        <Field label="Model">
          <select value={settings.local.model} onChange={(event) => patchLocal({ model: event.target.value })}>
            {LOCAL_MODELS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="setting-row">
          <span>Status</span>
          <b className="model-status">{localStatusLabel}</b>
        </div>
        {localStatus === 'loading' && (
          <div className="model-progress" role="progressbar" aria-valuenow={localPercent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${localPercent}%` }} />
          </div>
        )}
        {localError && <p className="setting-note error-text">{localError}</p>}
        <button
          type="button"
          className="ghost-btn wide"
          onClick={onPreloadModel}
          disabled={localStatus === 'loading'}
        >
          {localStatus === 'ready' ? 'MODEL READY' : localStatus === 'error' ? 'RETRY DOWNLOAD' : 'PRELOAD MODEL'}
        </button>
      </section>

      <section className="setting-group">
        <h3>SERVICE</h3>
        <p className="setting-note">
          Weather and geocoding are supplied by Open-Meteo and require no key. Speech recognition uses
          your browser's engine; Chrome and Edge provide the best results.
        </p>
        <button type="button" className="ghost-btn wide" onClick={onReset}>
          RESTORE DEFAULTS
        </button>
      </section>
    </Drawer>
  );
}

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="COMMAND MANUAL" subtitle="PROTOCOLS AVAILABLE TO THE LOCAL CORE">
      {HELP_GROUPS.map((group) => (
        <section className="setting-group help-group" key={group.title}>
          <h3>{group.title.toUpperCase()}</h3>
          {group.items.map((item) => (
            <div className="help-row" key={item.command}>
              <span className="help-command">{item.command}</span>
              <span className="help-desc">{item.description}</span>
            </div>
          ))}
        </section>
      ))}
      <section className="setting-group">
        <h3>KEYBOARD</h3>
        <div className="help-row">
          <span className="help-command">/</span>
          <span className="help-desc">Focus the command line.</span>
        </div>
        <div className="help-row">
          <span className="help-command">M</span>
          <span className="help-desc">Toggle the microphone.</span>
        </div>
        <div className="help-row">
          <span className="help-command">ESC</span>
          <span className="help-desc">Close panels and stop listening.</span>
        </div>
      </section>
    </Drawer>
  );
}
