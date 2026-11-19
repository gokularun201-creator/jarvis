import React from 'react';

export function Panel({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`panel ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  right,
  action,
}: {
  title: string;
  right?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-head">
      <span className="panel-title">
        <i className="panel-title-mark" />
        {title}
      </span>
      <span className="panel-head-right">
        {right && <span className="panel-meta">{right}</span>}
        {action}
      </span>
    </div>
  );
}

export function Meter({
  label,
  value,
  display,
  tone = 'accent',
}: {
  label: string;
  value: number;
  display: string;
  tone?: 'accent' | 'warn';
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`meter tone-${tone}`}>
      <div className="meter-top">
        <span className="meter-label">{label}</span>
        <span className="meter-value">{display}</span>
      </div>
      <div className="meter-track">
        <span className="meter-fill" style={{ width: `${pct}%` }} />
        <span className="meter-ticks" />
      </div>
    </div>
  );
}

export function IconButton({
  label,
  active,
  onClick,
  children,
  className = '',
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''} ${className}`}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
      <span className="toggle-text">{checked ? 'ON' : 'OFF'}</span>
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ------------------------------ icons ------------------------------ */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const MicIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <rect x="9" y="2.5" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3.5M8.5 21.5h7" />
  </svg>
);

export const SendIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 12 21 4l-4 17-5-6-8-3Z" />
  </svg>
);

export const GearIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
  </svg>
);

export const HelpIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.4 9a2.7 2.7 0 1 1 4 2.4c-.9.6-1.4 1.1-1.4 2.1M12 17h.01" />
  </svg>
);

export const SoundIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 9.5v5h3l4.5 3.5v-12L7 9.5H4Z" />
    <path d="M15.5 8.6a4.5 4.5 0 0 1 0 6.8M18.2 6a8 8 0 0 1 0 12" />
  </svg>
);

export const MuteIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 9.5v5h3l4.5 3.5v-12L7 9.5H4Z" />
    <path d="m15.5 9.5 5 5M20.5 9.5l-5 5" />
  </svg>
);

export const FullscreenIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
  </svg>
);

export const CloseIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const PlusIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TrashIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v5M14 11v5" />
  </svg>
);

export const RefreshIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 6M20 4.5V11h-6.5" />
  </svg>
);

export const PowerIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M12 3v8M6.3 6.3a8 8 0 1 0 11.4 0" />
  </svg>
);

export const WaveIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg {...base} {...p}>
    <path d="M3 12h2.5l2-6 3 12 3-9 2 3H21" />
  </svg>
);
