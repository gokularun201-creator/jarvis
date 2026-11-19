import type { Settings, Stats } from '../types';
import {
  FullscreenIcon,
  GearIcon,
  HelpIcon,
  MuteIcon,
  SoundIcon,
} from './ui';

function Pill({ label, state }: { label: string; state: 'on' | 'off' | 'warn' }) {
  return (
    <span className={`pill pill-${state}`}>
      <i />
      {label}
    </span>
  );
}

export default function TopBar({
  settings,
  stats,
  now,
  onSettings,
  onHelp,
  onToggleMute,
  onToggleAmbient,
  onFullscreen,
  localEnabled,
}: {
  settings: Settings;
  stats: Stats;
  now: Date;
  onSettings: () => void;
  onHelp: () => void;
  onToggleMute: () => void;
  onToggleAmbient: () => void;
  onFullscreen: () => void;
  localEnabled: boolean;
}) {
  const aiReady = settings.ai.enabled && Boolean(settings.ai.apiKey);
  const neuralOn = aiReady || localEnabled;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" width="38" height="38">
            <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
            <circle cx="20" cy="20" r="13" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 4" opacity="0.8" className="brand-spin" />
            <circle cx="20" cy="20" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="20" cy="20" r="2.2" fill="currentColor" />
            <path d="M20 3v5M20 32v5M3 20h5M32 20h5" stroke="currentColor" strokeWidth="1" opacity="0.6" />
          </svg>
        </div>
        <div className="brand-text">
          <h1 className="brand-name">
            J.A.R.V.I.S<span className="brand-caret">_</span>
          </h1>
          <p className="brand-sub">Just A Rather Very Intelligent System</p>
        </div>
      </div>

      <div className="status-cluster">
        <Pill label={stats.online ? 'UPLINK SECURE' : 'UPLINK LOST'} state={stats.online ? 'on' : 'warn'} />
        <Pill label={settings.muted ? 'VOICE OFF' : 'VOICE READY'} state={settings.muted ? 'off' : 'on'} />
        <Pill
          label={aiReady ? 'NEURAL LINK' : localEnabled ? 'ON-DEVICE CORE' : 'LOCAL CORE'}
          state={neuralOn ? 'on' : 'off'}
        />
      </div>

      <div className="top-actions">
        <div className="top-clock">
          <span className="top-time">{time}</span>
          <span className="top-date">{date}</span>
        </div>
        <div className="top-buttons">
          <button
            type="button"
            className={`icon-btn ${settings.muted ? '' : 'is-active'}`}
            onClick={onToggleMute}
            aria-label={settings.muted ? 'Enable voice' : 'Mute voice'}
            title={settings.muted ? 'Enable voice' : 'Mute voice'}
          >
            {settings.muted ? <MuteIcon /> : <SoundIcon />}
          </button>
          <button
            type="button"
            className={`icon-btn ${settings.ambient ? 'is-active' : ''}`}
            onClick={onToggleAmbient}
            aria-label="Ambient reactor audio"
            title="Ambient reactor audio"
            aria-pressed={settings.ambient}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 12h2l2-5 3 10 3-7 2 2h6" />
            </svg>
          </button>
          <button type="button" className="icon-btn" onClick={onHelp} aria-label="Command manual" title="Command manual">
            <HelpIcon />
          </button>
          <button type="button" className="icon-btn" onClick={onSettings} aria-label="Settings" title="Settings">
            <GearIcon />
          </button>
          <button type="button" className="icon-btn" onClick={onFullscreen} aria-label="Fullscreen" title="Fullscreen">
            <FullscreenIcon />
          </button>
        </div>
      </div>
    </header>
  );
}
