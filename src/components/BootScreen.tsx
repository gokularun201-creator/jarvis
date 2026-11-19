import { useEffect, useState } from 'react';

const LINES = [
  'ARC CORE HANDSHAKE .............. OK',
  'NEURAL LATTICE MOUNT ............ OK',
  'ENVIRONMENTAL UPLINK ............ SYNC',
  'COMMAND PROTOCOLS ............... 42 LOADED',
  'VOICE MATRIX .................... CALIBRATED',
  'SECURITY LAYER .................. SEALED',
];

export default function BootScreen({ onDone, callSign }: { onDone: () => void; callSign: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= LINES.length) {
      const timer = window.setTimeout(onDone, 620);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setCount((current) => current + 1), count === 0 ? 420 : 230);
    return () => window.clearTimeout(timer);
  }, [count, onDone]);

  const progress = Math.min(100, (count / LINES.length) * 100);

  return (
    <div className="boot" onClick={onDone} role="presentation">
      <div className="boot-grid" aria-hidden="true" />
      <div className="boot-inner">
        <div className="boot-mark" aria-hidden="true">
          <span className="boot-ring r1" />
          <span className="boot-ring r2" />
          <span className="boot-ring r3" />
          <span className="boot-dot" />
        </div>
        <h1 className="boot-title">
          J.A.R.V.I.S<span className="brand-caret">_</span>
        </h1>
        <p className="boot-sub">Just A Rather Very Intelligent System</p>

        <div className="boot-lines" role="status" aria-live="polite">
          {LINES.slice(0, count).map((line) => (
            <p key={line}>
              <span>{line.split(' ')[0]}</span>
              {line.slice(line.split(' ')[0].length)}
            </p>
          ))}
        </div>

        <div className="boot-progress">
          <span style={{ width: `${progress}%` }} />
        </div>

        <p className="boot-foot">
          {count >= LINES.length ? `ALL SYSTEMS ONLINE${callSign ? ` · ${callSign.toUpperCase()}` : ''}` : 'INITIALIZING…'}
        </p>
      </div>
    </div>
  );
}
