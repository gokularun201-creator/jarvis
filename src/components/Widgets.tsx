import { useState } from 'react';
import type { Note, Stats, TimerItem, WeatherData } from '../types';
import { describeCode } from '../lib/weather';
import { Meter, Panel, PanelHeader, PlusIcon, RefreshIcon, TrashIcon } from './ui';

/* ------------------------------------------------------------ clock */
export function ClockCard({ now }: { now: Date }) {
  const hours = now.getHours();
  const phase = hours < 5 ? 'NIGHT WATCH' : hours < 12 ? 'MORNING' : hours < 18 ? 'AFTERNOON' : 'EVENING';
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Panel className="clock-card">
      <PanelHeader title="CHRONOMETER" right="LOCAL" />
      <div className="clock-main">
        <span className="clock-time">{time}</span>
        <span className="clock-seconds">:{seconds}</span>
      </div>
      <div className="clock-date">{date}</div>
      <div className="clock-footer">
        <span className="tag">{phase}</span>
        <span className="clock-tz">
          {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, ' ')}
        </span>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------ environment */
export function EnvironmentCard({
  weather,
  loading,
  error,
  onRefresh,
}: {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const glyph = weather ? describeCode(weather.code).glyph : '◎';
  return (
    <Panel className="env-card">
      <PanelHeader
        title="ENVIRONMENT"
        right={weather ? 'LIVE' : loading ? 'SYNC' : 'IDLE'}
        action={
          <button type="button" className="icon-btn tiny" onClick={onRefresh} aria-label="Refresh weather" title="Refresh weather">
            <RefreshIcon width={14} height={14} />
          </button>
        }
      />
      {weather ? (
        <>
          <div className="env-main">
            <span className={`env-glyph ${weather.isDay ? 'day' : 'night'}`}>{glyph}</span>
            <div>
              <div className="env-temp">
                {weather.tempC}
                <span>°C</span>
              </div>
              <div className="env-city">{weather.city}</div>
            </div>
          </div>
          <p className="env-desc">{weather.desc}</p>
          <div className="env-grid">
            <div>
              <span>FEELS</span>
              <b>{weather.feelsC}°</b>
            </div>
            <div>
              <span>HUMIDITY</span>
              <b>{weather.humidity}%</b>
            </div>
            <div>
              <span>WIND</span>
              <b>{weather.windKph} km/h</b>
            </div>
          </div>
        </>
      ) : (
        <div className="env-empty">
          <span className="env-glyph">{loading ? '◌' : glyph}</span>
          <p>{error ?? (loading ? 'Acquiring atmospheric data…' : 'No environmental telemetry yet.')}</p>
          <button type="button" className="ghost-btn" onClick={onRefresh}>
            REQUEST REPORT
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------- system */
export function SystemCard({ stats }: { stats: Stats }) {
  const uptime = `${Math.floor(stats.uptime / 60)}m ${String(stats.uptime % 60).padStart(2, '0')}s`;
  const memoryPct =
    stats.heapMB !== null && stats.heapLimitMB ? (stats.heapMB / stats.heapLimitMB) * 100 : 0;

  return (
    <Panel className="system-card">
      <PanelHeader title="SYSTEM TELEMETRY" right={stats.online ? 'NOMINAL' : 'DEGRADED'} />
      <div className="meters">
        <Meter
          label="FRAME RATE"
          value={(stats.fps / 120) * 100}
          display={document.hidden ? 'PAUSED' : `${stats.fps} fps`}
          tone={stats.fps < 30 ? 'warn' : 'accent'}
        />
        <Meter
          label="JS HEAP"
          value={memoryPct}
          display={stats.heapMB !== null ? `${stats.heapMB} / ${stats.heapLimitMB} MB` : 'N/A'}
          tone={memoryPct > 80 ? 'warn' : 'accent'}
        />
        <Meter
          label="POWER CELL"
          value={stats.battery ?? (stats.cores ? 100 : 0)}
          display={stats.battery !== null ? `${stats.battery}%${stats.charging ? ' ⚡' : ''}` : `${stats.cores} cores`}
          tone={stats.battery !== null && stats.battery < 20 ? 'warn' : 'accent'}
        />
      </div>
      <div className="stat-grid">
        <div>
          <span>THREADS</span>
          <b>{stats.cores}</b>
        </div>
        <div>
          <span>LATENCY</span>
          <b>{stats.rtt !== null ? `${stats.rtt} ms` : '—'}</b>
        </div>
        <div>
          <span>UPTIME</span>
          <b>{uptime}</b>
        </div>
      </div>
    </Panel>
  );
}

/* ----------------------------------------------------------- notes */
export function NotesCard({
  notes,
  onAdd,
  onRemove,
  onClear,
}: {
  notes: Note[];
  onAdd: (text: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
  };

  return (
    <Panel className="notes-card">
      <PanelHeader
        title="MEMORY BANKS"
        right={`${notes.length} STORED`}
        action={
          notes.length > 0 ? (
            <button type="button" className="text-btn" onClick={onClear} title="Clear all notes">
              PURGE
            </button>
          ) : undefined
        }
      />
      <div className="note-list">
        {notes.length === 0 && <p className="empty-line">Say “remember to…” or add one below.</p>}
        {notes.slice(0, 8).map((note) => (
          <div className="note-row" key={note.id}>
            <span className="note-bullet">▸</span>
            <p>{note.text}</p>
            <button type="button" className="delete-btn" onClick={() => onRemove(note.id)} aria-label={`Delete note: ${note.text}`}>
              <TrashIcon width={13} height={13} />
            </button>
          </div>
        ))}
      </div>
      <form
        className="note-input"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Stored thought…"
          aria-label="Add a note"
          maxLength={180}
        />
        <button type="submit" className="icon-btn tiny" aria-label="Add note">
          <PlusIcon width={14} height={14} />
        </button>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------- timers */
export function TimersCard({ timers, onCancel }: { timers: TimerItem[]; onCancel: (id: string) => void }) {
  if (!timers.length) return null;
  return (
    <Panel className="timers-card">
      <PanelHeader title="ACTIVE TIMERS" right={`${timers.length}`} />
      <div className="timer-list">
        {timers.map((timer) => {
          const remaining = Math.max(0, timer.endsAt - Date.now());
          const total = timer.seconds * 1000;
          const progress = total > 0 ? ((total - remaining) / total) * 100 : 0;
          const mins = Math.floor(remaining / 60000);
          const secs = Math.floor((remaining % 60000) / 1000);
          return (
            <div className="timer-row" key={timer.id}>
              <div className="timer-top">
                <span className="timer-label">{timer.label}</span>
                <span className="timer-count">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
                <button type="button" className="delete-btn" onClick={() => onCancel(timer.id)} aria-label="Cancel timer">
                  ✕
                </button>
              </div>
              <div className="timer-track">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
