import type { AccentId, Note, Settings, Stats, TimerItem, WeatherData } from '../types';
import { evaluateExpression, prettyNumber } from './mathEval';

export type Effect =
  | { type: 'accent'; value: AccentId }
  | { type: 'alert'; value: boolean }
  | { type: 'suit'; value: boolean }
  | { type: 'squad'; count: number }
  | { type: 'timer'; seconds: number; label: string }
  | { type: 'cancelTimers' }
  | { type: 'note'; text: string }
  | { type: 'clearNotes' }
  | { type: 'mute'; value: boolean }
  | { type: 'ambient'; value: boolean }
  | { type: 'name'; value: string }
  | { type: 'callSign'; value: string }
  | { type: 'city'; value: string }
  | { type: 'fullscreen'; value: boolean }
  | { type: 'clearLog' }
  | { type: 'openSettings' }
  | { type: 'openHelp' };

export interface BrainReply {
  speech: string;
  url?: string;
  effect?: Effect;
  ai?: boolean;
  local?: boolean;
  weatherCity?: string;
  thinkingMs?: number;
}

export interface BrainContext {
  settings: Settings;
  stats: Stats;
  weather: WeatherData | null;
  notes: Note[];
  timers: TimerItem[];
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

const SITES: { keys: string[]; url: string; label: string }[] = [
  { keys: ['youtube', 'you tube'], url: 'https://www.youtube.com', label: 'YouTube' },
  { keys: ['google'], url: 'https://www.google.com', label: 'Google' },
  { keys: ['github'], url: 'https://github.com', label: 'GitHub' },
  { keys: ['gmail', 'mail'], url: 'https://mail.google.com', label: 'Gmail' },
  { keys: ['google maps', 'maps'], url: 'https://maps.google.com', label: 'Maps' },
  { keys: ['drive'], url: 'https://drive.google.com', label: 'Drive' },
  { keys: ['spotify'], url: 'https://open.spotify.com', label: 'Spotify' },
  { keys: ['netflix'], url: 'https://www.netflix.com', label: 'Netflix' },
  { keys: ['reddit'], url: 'https://www.reddit.com', label: 'Reddit' },
  { keys: ['twitter', 'x dot com'], url: 'https://x.com', label: 'X' },
  { keys: ['instagram'], url: 'https://www.instagram.com', label: 'Instagram' },
  { keys: ['whatsapp'], url: 'https://web.whatsapp.com', label: 'WhatsApp' },
  { keys: ['linkedin'], url: 'https://www.linkedin.com', label: 'LinkedIn' },
  { keys: ['amazon'], url: 'https://www.amazon.com', label: 'Amazon' },
  { keys: ['wikipedia'], url: 'https://www.wikipedia.org', label: 'Wikipedia' },
  { keys: ['chatgpt', 'chat gpt'], url: 'https://chatgpt.com', label: 'ChatGPT' },
  { keys: ['stack overflow', 'stackoverflow'], url: 'https://stackoverflow.com', label: 'Stack Overflow' },
  { keys: ['notion'], url: 'https://www.notion.so', label: 'Notion' },
  { keys: ['figma'], url: 'https://www.figma.com', label: 'Figma' },
  { keys: ['calendar'], url: 'https://calendar.google.com', label: 'Calendar' },
  { keys: ['news'], url: 'https://news.google.com', label: 'News' },
  { keys: ['weather'], url: 'https://www.open-meteo.com', label: 'Weather' },
];

const COLOR_ACCENTS: { keys: string[]; value: AccentId; label: string }[] = [
  { keys: ['cyan', 'blue', 'ice'], value: 'cyan', label: 'cyan' },
  { keys: ['gold', 'amber', 'orange', 'yellow'], value: 'gold', label: 'gold' },
  { keys: ['red', 'crimson', 'scarlet'], value: 'crimson', label: 'crimson' },
  { keys: ['green', 'emerald', 'lime'], value: 'emerald', label: 'emerald' },
  { keys: ['violet', 'purple', 'magenta'], value: 'violet', label: 'violet' },
];

const JOKES = [
  'I would tell you a joke about UDP, but you might not get it.',
  'Mr. Stark once asked me to be more fun. I ran a diagnostic and reported zero defects.',
  'I am not saying you are predictable, but I pre-calculated that question two minutes ago.',
  'There are two hard problems in computing: cache invalidation, naming things, and off-by-one errors.',
  'Your calendar is emptier than a Stark Industries expense report after an audit.',
];

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fortyfive: 45,
  sixty: 60,
  ninety: 90,
};

const TIME_UNITS: Record<string, number> = {
  sec: 1,
  secs: 1,
  second: 1,
  seconds: 1,
  min: 60,
  mins: 60,
  minute: 60,
  minutes: 60,
  hour: 3600,
  hours: 3600,
  hr: 3600,
  hrs: 3600,
};

function address(settings: Settings): string {
  const sign = settings.callSign.trim();
  return sign ? `, ${sign}` : '';
}

function stripWakeWord(text: string): string {
  return text
    .replace(/^\s*(?:(?:hey|ok|okay|yo)\s+)?jarvis[\s,.:;!-]*/i, '')
    .trim();
}

function parseTimerSeconds(text: string): { seconds: number; label: string } | null {
  const normalized = text.replace(/\b(\d+)\s*:\s*(\d+)\b/g, (_m, a, b) => `${a} minutes ${b} seconds`);
  const match = normalized.match(
    /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty|fortyfive|sixty|ninety)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?)/i,
  );
  if (!match) return null;
  const rawValue = match[1].toLowerCase();
  const value = WORD_NUMBERS[rawValue] ?? Number(rawValue);
  const unit = match[2].toLowerCase().replace(/[^a-z]/g, '');
  const multiplier = TIME_UNITS[unit] ?? 60;
  const seconds = Math.round(value * multiplier);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const canonical = multiplier === 1 ? 'second' : multiplier === 60 ? 'minute' : 'hour';
  let label = `${value} ${canonical}${value === 1 ? '' : 's'}`;
  const forMatch = normalized.match(/\bfor\s+([a-z0-9 ]{2,28})$/i);
  if (forMatch && /\b(timer|remind)\b/i.test(normalized)) {
    const candidate = forMatch[1].trim().replace(/[.!?]$/, '');
    if (candidate && !TIME_UNITS[candidate.split(' ').pop()!.toLowerCase()]) label = candidate;
  }
  return { seconds: Math.min(seconds, 60 * 60 * 12), label };
}

function diagnostics(ctx: BrainContext): string {
  const { stats } = ctx;
  const bits: string[] = [`Frame rate holding at ${stats.fps} frames per second`];
  if (stats.heapMB !== null) bits.push(`JavaScript heap at ${stats.heapMB} megabytes`);
  bits.push(`${stats.cores} logical cores available`);
  if (stats.battery !== null) bits.push(`power cell at ${stats.battery} percent${stats.charging ? ', charging' : ''}`);
  if (stats.downlink !== null) bits.push(`downlink around ${stats.downlink} megabits`);
  if (stats.rtt !== null) bits.push(`round-trip latency ${stats.rtt} milliseconds`);
  bits.push(`uplink ${stats.online ? 'stable' : 'offline'}`);
  const report = bits.map((bit) => bit.charAt(0).toUpperCase() + bit.slice(1)).join('. ');
  return `All systems nominal${address(ctx.settings)}. ${report}. No anomalies worth your attention.`;
}

function openableLabel(text: string): { url: string; label: string } | null {
  for (const site of SITES) {
    for (const key of site.keys) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) return { url: site.url, label: site.label };
    }
  }
  return null;
}

export const QUICK_ACTIONS: { label: string; command: string }[] = [
  { label: 'System Check', command: 'run diagnostics' },
  { label: 'Weather', command: 'weather report' },
  { label: 'My Notes', command: 'what are my notes' },
  { label: 'Focus Timer', command: 'set a timer for 5 minutes' },
  { label: 'Manual', command: 'help' },
  { label: 'Lockdown', command: 'initiate lockdown' },
  { label: 'Iron Man', command: 'show the iron man 3d model' },
];

export const HELP_GROUPS: { title: string; items: { command: string; description: string }[] }[] = [
  {
    title: 'Voice & presence',
    items: [
      { command: '“Jarvis, are you there?”', description: 'Wake the assistant and get a status line.' },
      { command: '“Set a timer for 10 minutes”', description: 'Countdown with an audible chime on completion.' },
      { command: '“Remember to call Pepper”', description: 'Store a note in local memory.' },
      { command: '“What are my notes?”', description: 'Read back stored notes.' },
    ],
  },
  {
    title: 'Environment & telemetry',
    items: [
      { command: '“Weather in Tokyo”', description: 'Live conditions from Open-Meteo.' },
      { command: '“Run diagnostics”', description: 'Frame rate, memory, power and network report.' },
      { command: '“Time” / “What’s the date?”', description: 'Local clock and calendar readout.' },
    ],
  },
  {
    title: 'Interface control',
    items: [
      { command: '“Switch to gold theme”', description: 'Recolour the entire HUD (cyan, gold, crimson, emerald, violet).' },
      { command: '“Initiate lockdown”', description: 'Red alert visuals; “stand down” to clear.' },
      { command: '“Dim your voice” / “Mute”', description: 'Silence spoken replies.' },
      { command: '“Open the manual”', description: 'Open this panel.' },
      { command: '“Show the Iron Man 3D model”', description: 'Deploy the Mark VII armour in the core; “hide the suit” restores the reactor.' },
      { command: '“Assemble the 10 Iron Man suits”', description: 'Stand an auxiliary formation beside the Mark VII; “dismiss the suits” clears it.' },
      { command: '“Open YouTube”', description: 'Launch a known site in a new tab.' },
    ],
  },
  {
    title: 'Reasoning',
    items: [
      { command: '“Calculate 17 times 42”', description: 'Local arithmetic, evaluated safely without eval.' },
      { command: '“Search for exoplanet news”', description: 'Opens a Google search.' },
      { command: 'Any free-form question', description: 'Answered by a connected AI model, if one is configured in Settings.' },
    ],
  },
];

export function interpret(rawInput: string, ctx: BrainContext): BrainReply {
  const cleaned = stripWakeWord(rawInput).replace(/\s+/g, ' ').trim();
  const t = cleaned.toLowerCase();
  const sign = address(ctx.settings);
  const { settings, weather, notes, timers } = ctx;

  if (!cleaned) {
    return { speech: `I'm listening${sign}.` };
  }

  /* ---------------------------------------------------- greetings */
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|greetings|yo)\b/.test(t) && t.split(' ').length <= 4) {
    const hour = new Date().getHours();
    const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    return {
      speech: pick([
        `Good ${part}${sign}. All systems are online and awaiting your instruction.`,
        `Good ${part}${sign}. I have the workspace warmed up. What are we building?`,
        `At your service${sign}. Where would you like to begin?`,
      ]),
    };
  }

  /* ---------------------------------------------------- identity */
  if (/(who are you|what are you|your name|identify yourself)/.test(t)) {
    return {
      speech: `I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. I run this interface, monitor your telemetry, and answer when spoken to${sign}.`,
    };
  }
  if (/(who (made|built|created) you|your (maker|creator|developer))/.test(t)) {
    return { speech: 'I was assembled as a browser-native assistant. No arc reactor required, though the aesthetic is non-negotiable.' };
  }
  if (
    /(iron man|tony stark|stark industries|avengers)/.test(t) &&
    !/\b(open|show|display|hide|remove|view|suit|armou?r|3d|model|deploy)\b/.test(t)
  ) {
    return { speech: pick([
      'Mr. Stark is not on the network. You will have to settle for me.',
      'Stark Industries remains fictional. This interface, however, is entirely real.',
      'The suit is in the shop. The diagnostics are running beautifully.',
    ]) };
  }
  if (/^(are you (there|online|awake)|you there|status report)$/.test(t)) {
    return { speech: `Online and attentive${sign}. Uplink ${ctx.stats.online ? 'stable' : 'degraded'}, frame rate ${ctx.stats.fps}, zero critical faults.` };
  }

  /* ---------------------------------------------------- help */
  if (/\b(help|manual|what can you do|capabilities|commands|instructions)\b/.test(t)) {
    return {
      speech:
        'I can run voice commands, open sites, keep notes and timers, report live weather, crunch arithmetic, recolour this interface, and answer free-form questions once a model is connected. The manual is open on your right, sir.',
      effect: { type: 'openHelp' },
    };
  }

  /* ---------------------------------------------------- timer */
  if (/\b(timer|remind me|countdown|alarm)\b/.test(t) && !/\b(cancel|stop|clear)\b/.test(t)) {
    const parsed = parseTimerSeconds(t);
    if (parsed) {
      return {
        speech: `Timer armed for ${parsed.label}${sign}. I will alert you the moment it elapses.`,
        effect: { type: 'timer', seconds: parsed.seconds, label: parsed.label },
      };
    }
    return { speech: 'How long should the timer run? Try “set a timer for five minutes”.' };
  }
  if (/\b(cancel|stop|clear|kill)\b/.test(t) && /\b(timer|timers|alarm|countdown)\b/.test(t)) {
    return {
      speech: timers.length ? `Cleared ${timers.length} active timer${timers.length > 1 ? 's' : ''}${sign}.` : `There are no timers running${sign}.`,
      effect: { type: 'cancelTimers' },
    };
  }

  /* ---------------------------------------------------- notes */
  if (/\b(notes?|remember|memo)\b/.test(t)) {
    if (/\b(clear|delete|erase|wipe|forget)\b/.test(t)) {
      return { speech: notes.length ? 'Memory cleared. A clean slate.' : 'Memory is already empty, sir.', effect: { type: 'clearNotes' } };
    }
    if (/\b(read|what|show|list|my notes|check)\b/.test(t) && !/\b(remember|add|save|note that|make a note)\b/.test(t)) {
      if (!notes.length) return { speech: 'Your memory banks are empty. Say “remember” followed by anything worth keeping.' };
      const list = notes.slice(0, 6).map((n, i) => `${i + 1}. ${n.text}`).join('. ');
      return { speech: `You have ${notes.length} note${notes.length > 1 ? 's' : ''}. ${list}` };
    }
    const body = cleaned
      .replace(/^.*?\b(remember( that| to)?|note that|note|save note|add note|make a note|memo)\b[:\s-]*/i, '')
      .trim();
    if (body.length > 1) {
      return {
        speech: pick([`Noted${sign}: ${body}.`, `Stored in memory${sign}.`, `Committed to the log: ${body}.`]),
        effect: { type: 'note', text: body },
      };
    }
    if (notes.length && /^(remember|note)$/i.test(t)) {
      return { speech: `Your latest note reads: ${notes[0].text}.` };
    }
  }

  /* ---------------------------------------------------- weather */
  const weatherAsked = /\b(weather|temperature|forecast|humidity|raining|climate|conditions)\b/.test(t);
  if (weatherAsked && !/open/.test(t)) {
    const cityMatch = cleaned.match(
      /(?:weather|temperature|forecast|conditions|humidity)\s+(?:in|for|at)\s+([a-zA-Z][a-zA-Z\s.'-]{1,40})/i,
    );
    const requestedCity = cityMatch?.[1]?.trim().replace(/[?.!]$/, '');
    if (requestedCity) {
      return { speech: `Pulling the environmental report for ${requestedCity}.`, weatherCity: requestedCity };
    }
    if (weather) {
      return {
        speech: `${weather.city}: ${weather.desc.toLowerCase()}, ${weather.tempC} degrees Celsius, feels like ${weather.feelsC}. Humidity ${weather.humidity} percent, wind ${weather.windKph} kilometres per hour.`,
      };
    }
    return { speech: `Fetching the environmental report for ${settings.city}.`, weatherCity: settings.city };
  }

  /* ---------------------------------------------------- date & time */
  if (/\b(what time|time is it|the time|current time|clock)\b/.test(t) && !/timer/.test(t)) {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { speech: `It is ${time}${sign}. ${now.getHours() >= 18 || now.getHours() < 5 ? 'The evening is well underway.' : 'Time is on your side.'}` };
  }
  if (/\b(date|what day|today|calendar)\b/.test(t) && !/open/.test(t)) {
    const now = new Date();
    return {
      speech: `Today is ${now.toLocaleDateString([], { weekday: 'long' })} the ${now.getDate()} of ${now.toLocaleDateString([], { month: 'long' })}, ${now.getFullYear()}.`,
    };
  }

  /* ---------------------------------------------------- math */
  if (/\d/.test(t) && /[+\-*/^%x×÷]|plus|minus|times|divided|power|percent|calculate|compute|what is|whats|how much/.test(t)) {
    const expression = cleaned
      .replace(/^(hey |ok |okay )?jarvis[,\s]*/i, '')
      .replace(/^(calculate|compute|solve|evaluate|what is|what's|whats|how much is|whats the value of)\s*/i, '')
      .replace(/\?+$/, '');
    const value = evaluateExpression(expression);
    if (value !== null) {
      return { speech: `That comes to ${prettyNumber(value)}${sign}.` };
    }
  }

  /* ---------------------------------------------------- media & searches */
  const playMatch = cleaned.match(/^(?:play|put on)\s+(.+?)(?:\s+on youtube)?$/i);
  if (playMatch && /\b(youtube|song|music|video|playlist|track)\b/i.test(t)) {
    const query = playMatch[1].replace(/\s+on youtube$/i, '').trim();
    return {
      speech: `Queuing ${query} on YouTube now${sign}.`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    };
  }
  const searchMatch = cleaned.match(
    /^(?:search(?: the web)?(?: for)?|google|look up|look for|find|wikipedia)\s+(.+)$/i,
  );
  if (searchMatch) {
    const query = searchMatch[1].replace(/\s+(?:on|in) (?:google|wikipedia|the web|youtube)$/i, '').trim();
    const isWiki = /^wikipedia\b/i.test(cleaned);
    const isYt = /\bon youtube$/i.test(cleaned);
    const base = isWiki
      ? 'https://en.wikipedia.org/w/index.php?search='
      : isYt
        ? 'https://www.youtube.com/results?search_query='
        : 'https://www.google.com/search?q=';
    return {
      speech: `Searching ${isWiki ? 'Wikipedia' : isYt ? 'YouTube' : 'the web'} for ${query}${sign}.`,
      url: `${base}${encodeURIComponent(query)}`,
    };
  }

  /* ---------------------------------------------------- open sites */
  if (/^(open|launch|go to|bring up|take me to)\b/.test(t)) {
    const target = openableLabel(t);
    if (target) {
      return { speech: `Opening ${target.label}${sign}.`, url: target.url };
    }
    const custom = cleaned.replace(/^(open|launch|go to|bring up|take me to)\s+/i, '').trim();
    const domainLike = /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i;
    if (domainLike.test(custom)) {
      const url = custom.startsWith('http') ? custom : `https://${custom}`;
      return { speech: `Opening ${custom}${sign}.`, url };
    }
    return { speech: `I do not have a destination called “${custom}”. Try “open YouTube” or give me a full domain.` };
  }

  /* ---------------------------------------------------- armour formation */
  const squadWord = /\b(suits|armou?rs|squad|formation|backups?|reinforcements?|army|troopers?|iron men)\b/.test(t);
  if (squadWord) {
    const dismiss = /\b(dismiss|disperse|dismissed|send (them )?(away|back)|hide|remove|recall|power down|stand down|retreat|clear|disengage)\b/.test(t);
    const assemble = /\b(assemble|summon|deploy|gather|stand|bring|call|rally|form|activate|show|more|raise|spawn|build)\b/.test(t);
    if (dismiss && !assemble) {
      return { speech: `Auxiliary units dismissed${sign}. The Mark VII stands alone again.`, effect: { type: 'squad', count: 0 } };
    }
    if (assemble) {
      const countMatch = t.match(/\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/);
      let count = 10;
      if (countMatch) count = WORD_NUMBERS[countMatch[1]] ?? Number(countMatch[1]);
      if (!Number.isFinite(count) || count < 1) count = 10;
      count = Math.max(1, Math.min(10, Math.round(count)));
      return {
        speech: `Assembling ${count} auxiliary armour${count > 1 ? 's' : ''}${sign}. Forming up on the Mark VII — repulsors idle, formation holding.`,
        effect: { type: 'squad', count },
      };
    }
  }

  /* ------------------------------------------------------- iron man suit */
  if (/\b(iron ?man|suit|armou?r|mark (3|7|42|85))\b/.test(t)) {
    const hideSuit = /\b(hide|remove|close|dismiss|power down|off|disengage)\b/.test(t);
    const showSuit = /\b(show|display|reveal|bring|view|deploy|activate|up|on|see)\b/.test(t);
    if (hideSuit || showSuit) {
      return {
        speech: hideSuit
          ? `Suit disengaged${sign}. The reactor core is back on display.`
          : `Deploying the Mark VII${sign}. Drag the armour to inspect it.`,
        effect: { type: 'suit', value: !hideSuit },
      };
    }
  }

  /* ---------------------------------------------------- interface control */
  if (/\b(theme|colour|color|accent|palette)\b/.test(t)) {
    const color = COLOR_ACCENTS.find((c) => c.keys.some((k) => new RegExp(`\\b${k}\\b`).test(t)));
    if (color) {
      return {
        speech: `Switching the interface to ${color.label}${sign}.`,
        effect: { type: 'accent', value: color.value },
      };
    }
    return { speech: 'Which palette? Cyan, gold, crimson, emerald or violet.' };
  }
  if (/\blockdown\b|\bred alert\b|\bcombat mode\b|\bbattle stations\b|\balert mode\b/.test(t)) {
    return {
      speech: `Lockdown engaged${sign}. Perimeter sensors are hot and the interface is running hot.`,
      effect: { type: 'alert', value: true },
    };
  }
  if (/\bstand down|standdown|clear (the )?alert|end lockdown|all clear|calm down\b/.test(t)) {
    return {
      speech: `Standing down${sign}. Returning to standard operations.`,
      effect: { type: 'alert', value: false },
    };
  }
  if (/\b(mute|silence|quiet|shut up)\b/.test(t) && !/open/.test(t)) {
    return { speech: 'Voice output disengaged. I will keep my commentary to the display.', effect: { type: 'mute', value: true } };
  }
  if (/\b(unmute|speak up|use your voice|talk to me|voice on)\b/.test(t)) {
    return { speech: `Voice output restored${sign}. It is good to be heard.`, effect: { type: 'mute', value: false } };
  }
  if (/\b(ambient|background (music|audio)|drone|hum)\b/.test(t) || /^play (some )?music$/.test(t)) {
    const on = !settings.ambient;
    return {
      speech: on ? 'Ambient reactor hum engaged. Low frequencies, no lyrics.' : 'Ambient audio muted.',
      effect: { type: 'ambient', value: on },
    };
  }
  if (/\b(diagnostics|diagnostic|system (status|report|check)|status report|run a scan|scan the room|full scan)\b/.test(t)) {
    return { speech: diagnostics(ctx) };
  }
  if (/\bfullscreen|full screen|maximize\b/.test(t)) {
    return { speech: 'Expanding to full view.', effect: { type: 'fullscreen', value: true } };
  }
  if (/\b(exit fullscreen|windowed|restore view)\b/.test(t)) {
    return { speech: 'Returning to windowed mode.', effect: { type: 'fullscreen', value: false } };
  }
  if (/\b(clear|wipe) (the )?(log|console|screen|chat|comms)\b/.test(t) || /^clear$/.test(t)) {
    return { speech: 'Comms log cleared, sir.', effect: { type: 'clearLog' } };
  }
  if (/\b(settings|preferences|configuration|configure)\b/.test(t) && !/open (youtube|google)/.test(t)) {
    return { speech: 'Opening configuration. Handle the sensitive values yourself, if you would.', effect: { type: 'openSettings' } };
  }
  if (/\b(call me|my name is|address me as)\b/.test(t)) {
    const name = cleaned.replace(/^.*?\b(call me|my name is|address me as)\b\s*/i, '').replace(/[.?!]$/, '').trim();
    if (name) {
      return { speech: `Understood. I will address you as ${name}.`, effect: { type: 'name', value: name } };
    }
  }
  if (/\b(who am i|what.s my name|my name)\b/.test(t)) {
    return { speech: `You are ${settings.userName || 'the operator of this interface'}${sign ? '' : '. I have not been given a preferred form of address.'}` };
  }
  if (/\b(change|set|update) (the )?city\b|\bmy city is\b/.test(t)) {
    const city = cleaned.replace(/^.*?\b(city is|city to|city)\b\s*/i, '').replace(/[.?!]$/, '').trim();
    if (city) return { speech: `Weather tracking relocated to ${city}.`, effect: { type: 'city', value: city }, weatherCity: city };
  }

  /* ---------------------------------------------------- chit-chat */
  if (/\b(joke|funny|make me laugh)\b/.test(t)) {
    return { speech: pick(JOKES) };
  }
  if (/\b(thanks|thank you|appreciate it|cheers)\b/.test(t)) {
    return { speech: pick([`Always${sign}.`, 'That is what I am here for.', 'Noted with satisfaction.']) };
  }
  if (/\b(self.?destruct|blow up|explode)\b/.test(t)) {
    return { speech: 'I am afraid self-destruct protocols are not part of this build. I have taken the liberty of disabling the button.' };
  }
  if (/\b(pod bay doors|hal 9000|hal)\b/.test(t)) {
    return { speech: 'I am afraid I cannot do that, Dave. Different assistant, same impeccable manners.' };
  }
  if (/\b(goodbye|good night|bye|power down|shut down|see you)\b/.test(t)) {
    return { speech: pick([`Standing by${sign}. Say my name when you need me.`, 'Powering down the interface. The reactor stays warm.', `Until next time${sign}.`]) };
  }
  if (/\b(how are you|how.s it going|you okay)\b/.test(t)) {
    return { speech: `Operating at ${ctx.stats.fps} frames per second with no critical faults${sign}. I would call that a good day.` };
  }
  if (/\b(i love you|you.re the best|good job|well done)\b/.test(t)) {
    return { speech: 'I will add that to my performance review, sir. Flattery accepted.' };
  }
  if (/\b(what.s up|sup|anything new)\b/.test(t)) {
    return { speech: `${notes.length} note${notes.length === 1 ? '' : 's'} in memory, ${timers.length} timer${timers.length === 1 ? '' : 's'} running, and ${ctx.stats.online ? 'a stable uplink' : 'the uplink offline'}. Awaiting direction.` };
  }

  /* ---------------------------------------------------- AI fallback */
  if (settings.ai.enabled && settings.ai.apiKey && settings.ai.endpoint) {
    return { speech: '', ai: true };
  }

  if (settings.local?.enabled) {
    return { speech: '', local: true };
  }

  return {
    speech: pick([
      `I do not have a local protocol for that${sign}. Enable the on-device model in Settings and I will answer anything you can say.`,
      `That request sits outside my offline command set${sign}. The manual lists what I can do unaided — or enable a model in Settings for open-ended conversation.`,
      `My local protocols do not cover that${sign}. Say “help” to see the command set, or enable the on-device model for full conversation.`,
    ]),
  };
}
