import type { Message } from '../types';
import { useAutoScroll } from '../hooks/useVoices';
import { Panel, PanelHeader } from './ui';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Comms({
  messages,
  thinking,
  transcript,
  listening,
  onClear,
}: {
  messages: Message[];
  thinking: boolean;
  transcript: string;
  listening: boolean;
  onClear: () => void;
}) {
  const endRef = useAutoScroll<HTMLDivElement>(messages.length + (thinking ? 1 : 0) + transcript.length);

  return (
    <Panel className="comms">
      <PanelHeader
        title="COMMUNICATIONS"
        right="ENCRYPTED"
        action={
          <button type="button" className="text-btn" onClick={onClear} title="Clear the comms log">
            CLEAR
          </button>
        }
      />
      <div className="comms-log" ref={endRef}>
        {messages.map((message) => (
          <div key={message.id} className={`msg msg-${message.role}`}>
            <div className="msg-meta">
              <span className="msg-author">
                {message.role === 'user' ? 'OPERATOR' : message.role === 'jarvis' ? 'J.A.R.V.I.S' : 'SYSTEM'}
              </span>
              <span className="msg-time">{formatTime(message.time)}</span>
            </div>
            <p className="msg-text">{message.text}</p>
          </div>
        ))}

        {listening && transcript && (
          <div className="msg msg-user msg-interim">
            <div className="msg-meta">
              <span className="msg-author">OPERATOR · LIVE</span>
            </div>
            <p className="msg-text">{transcript}</p>
          </div>
        )}

        {thinking && (
          <div className="msg msg-jarvis msg-thinking">
            <div className="msg-meta">
              <span className="msg-author">J.A.R.V.I.S</span>
            </div>
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
