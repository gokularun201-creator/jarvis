import { forwardRef } from 'react';
import { MuteIcon, SendIcon, SoundIcon } from './ui';

export interface CommandChip {
  label: string;
  command: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onMic: () => void;
  listening: boolean;
  micSupported: boolean;
  muted: boolean;
  onToggleMute: () => void;
  busy: boolean;
  chips: CommandChip[];
  notice: string | null;
}

const CommandBar = forwardRef<HTMLInputElement, Props>(function CommandBar(
  {
    value,
    onChange,
    onSubmit,
    onMic,
    listening,
    micSupported,
    muted,
    onToggleMute,
    busy,
    chips,
    notice,
  },
  ref,
) {
  const status = listening
    ? 'Listening — speak your command'
    : busy
      ? 'Processing…'
      : micSupported
        ? 'Awaiting instruction · press / to type · M for microphone'
        : 'Type your command · microphone unavailable in this browser';

  return (
    <div className="command-dock">
      <div className="dock-chips">
        <span className="dock-chips-label">QUICK</span>
        {chips.map((chip) => (
          <button key={chip.command} type="button" className="chip" onClick={() => onSubmit(chip.command)}>
            {chip.label}
          </button>
        ))}
      </div>

      <form
        className={`command-shell ${listening ? 'is-listening' : ''}`}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(value);
        }}
      >
        <button
          type="button"
          className={`mic-btn ${listening ? 'live' : ''}`}
          onClick={onMic}
          aria-label={listening ? 'Stop listening' : 'Start voice input'}
          title={listening ? 'Stop listening' : 'Start voice input (M)'}
        >
          {listening ? (
            <span className="mic-eq" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <rect x="9" y="2.5" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
            </svg>
          )}
        </button>

        <span className="shell-prefix" aria-hidden="true">
          ›
        </span>

        <input
          ref={ref}
          className="command-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Speak, or type a command…"
          aria-label="Command input"
          autoComplete="off"
          spellCheck={false}
          maxLength={500}
        />

        <span className="shell-kbd" aria-hidden="true">
          /
        </span>

        <button
          type="button"
          className={`voice-btn ${muted ? 'off' : ''}`}
          onClick={onToggleMute}
          aria-label={muted ? 'Enable spoken replies' : 'Mute spoken replies'}
          title={muted ? 'Enable spoken replies' : 'Mute spoken replies'}
        >
          {muted ? <MuteIcon width={15} height={15} /> : <SoundIcon width={15} height={15} />}
        </button>

        <button type="submit" className="engage-btn" disabled={busy || !value.trim()}>
          <SendIcon width={15} height={15} />
          <span>ENGAGE</span>
        </button>
      </form>

      <div className="dock-status">
        <span className={`dock-dot ${listening ? 'live' : busy ? 'busy' : ''}`} />
        <span>{notice ?? status}</span>
        <span className="dock-status-right">
          LOCAL CORE v1.0 · {micSupported ? 'VOICE READY' : 'VOICE N/A'}
        </span>
      </div>
    </div>
  );
});

export default CommandBar;
