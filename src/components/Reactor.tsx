import type { ReactorState } from '../types';
import IronManModel from './IronManModel';

const TICKS = Array.from({ length: 72 }, (_, i) => i * 5);

const READOUT: Record<ReactorState, string> = {
  idle: 'CORE STABLE',
  listening: 'LISTENING',
  thinking: 'PROCESSING',
  speaking: 'TRANSMITTING',
};

export default function Reactor({
  state,
  suitVisible,
  squad,
}: {
  state: ReactorState;
  suitVisible: boolean;
  squad: number;
}) {
  return (
    <div className={`reactor state-${state} ${suitVisible ? 'has-suit' : ''} ${squad > 0 ? 'has-squad' : ''}`}>
      <div className="reactor-glow" />

      <div className="reactor-waves" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <svg className="reactor-svg" viewBox="0 0 400 400" role="img" aria-label={`Reactor core: ${READOUT[state]}`}>
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="coreRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.35" />
          </linearGradient>
          <filter id="softGlow" x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="3.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ring ring-outer">
          <circle cx="200" cy="200" r="192" strokeDasharray="1 9" opacity="0.5" />
        </g>

        <g className="ring ring-ticks">
          {TICKS.map((angle) => (
            <line
              key={angle}
              x1="200"
              y1="14"
              x2="200"
              y2={angle % 15 === 0 ? 30 : 24}
              transform={`rotate(${angle} 200 200)`}
              opacity={angle % 15 === 0 ? 0.85 : 0.3}
              strokeWidth={angle % 15 === 0 ? 1.6 : 1}
            />
          ))}
        </g>

        <g className="ring ring-a">
          <circle cx="200" cy="200" r="170" strokeWidth="2" strokeDasharray="148 46 24 62" opacity="0.6" />
        </g>

        <g className="ring ring-b">
          <circle cx="200" cy="200" r="154" strokeWidth="7" strokeDasharray="9 15" opacity="0.13" />
          <circle cx="200" cy="200" r="154" strokeWidth="1" opacity="0.18" />
        </g>

        <g className="ring ring-c">
          <circle cx="200" cy="200" r="134" strokeWidth="1.6" strokeDasharray="72 30 10 40" opacity="0.55" />
        </g>

        <g className="ring ring-d">
          <circle cx="200" cy="200" r="114" strokeWidth="1" strokeDasharray="2 7" opacity="0.4" />
        </g>

        <g className="ring ring-tri">
          <polygon points="200,114 272,242 128,242" strokeWidth="1.2" opacity="0.55" />
          <polygon points="200,286 128,158 272,158" strokeWidth="1" opacity="0.22" />
        </g>

        <g className="ring ring-orbit">
          <circle cx="200" cy="200" r="96" strokeWidth="1" opacity="0.12" />
          <circle cx="296" cy="200" r="3.2" fill="var(--accent)" stroke="none" />
          <circle cx="104" cy="200" r="2" fill="var(--accent)" stroke="none" opacity="0.7" />
        </g>

        <g className="ring ring-orbit-rev">
          <circle cx="200" cy="200" r="143" strokeWidth="1" opacity="0.08" />
          <circle cx="200" cy="57" r="2.4" fill="var(--accent)" stroke="none" />
        </g>

        <g className="core">
          <circle cx="200" cy="200" r="78" fill="url(#coreGlow)" stroke="none" opacity="0.55" />
          <circle cx="200" cy="200" r="46" fill="var(--accent)" stroke="none" opacity="0.08" />
          <circle cx="200" cy="200" r="32" fill="none" stroke="url(#coreRing)" strokeWidth="1.6" filter="url(#softGlow)" />
          <circle cx="200" cy="200" r="21" fill="none" strokeWidth="1" strokeDasharray="4 5" opacity="0.7" />
          <circle cx="200" cy="200" r="7" fill="var(--accent)" stroke="none" filter="url(#softGlow)" className="core-dot" />
        </g>
      </svg>

      {suitVisible && (
        <div className="suit-stage">
          <IronManModel state={state} squad={squad} />
        </div>
      )}

      {suitVisible && (
        <div className="suit-meta" aria-hidden="true">
          <span>{squad > 0 ? `MARK VII · ${squad} AUXILIARY UNITS` : 'MARK VII · REPULSOR READY'}</span>
          <span>DRAG TO ROTATE</span>
        </div>
      )}

      <div className="reactor-labels" aria-hidden="true">
        <span className="reactor-label tl">PWR · 98.4%</span>
        <span className="reactor-label tr">SYNC · LOCKED</span>
        <span className="reactor-label bl">γ 0.0042</span>
        <span className="reactor-label br">TEMP · 32°C</span>
      </div>

      <div className="reactor-status">
        <span className={`reactor-status-dot ${state}`} />
        <span className="reactor-status-text">{READOUT[state]}</span>
      </div>
    </div>
  );
}
