export type AccentId = 'cyan' | 'gold' | 'crimson' | 'emerald' | 'violet';

export interface AIConfig {
  enabled: boolean;
  endpoint: string;
  model: string;
  apiKey: string;
}

export interface LocalModelConfig {
  enabled: boolean;
  model: string;
}

export interface Settings {
  userName: string;
  callSign: string;
  city: string;
  accent: AccentId;
  muted: boolean;
  ambient: boolean;
  rate: number;
  ai: AIConfig;
  local: LocalModelConfig;
}

export type Role = 'user' | 'jarvis' | 'system';

export interface Message {
  id: string;
  role: Role;
  text: string;
  time: number;
}

export type DrawerId = 'settings' | 'help' | null;

export interface TimerItem {
  id: string;
  label: string;
  endsAt: number;
  seconds: number;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

export interface WeatherData {
  city: string;
  tempC: number;
  feelsC: number;
  humidity: number;
  windKph: number;
  code: number;
  desc: string;
  isDay: boolean;
  updatedAt: number;
}

export interface Stats {
  fps: number;
  heapMB: number | null;
  heapLimitMB: number | null;
  cores: number;
  battery: number | null;
  charging: boolean;
  online: boolean;
  downlink: number | null;
  rtt: number | null;
  uptime: number;
}

export type ReactorState = 'idle' | 'listening' | 'thinking' | 'speaking';
