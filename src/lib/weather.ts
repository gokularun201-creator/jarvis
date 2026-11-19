import type { WeatherData } from '../types';

const DESCRIPTORS: Record<number, { desc: string; glyph: string }> = {
  0: { desc: 'Clear sky', glyph: '☀' },
  1: { desc: 'Mainly clear', glyph: '☀' },
  2: { desc: 'Partly cloudy', glyph: '⛅' },
  3: { desc: 'Overcast', glyph: '☁' },
  45: { desc: 'Fog', glyph: '≋' },
  48: { desc: 'Freezing fog', glyph: '≋' },
  51: { desc: 'Light drizzle', glyph: '☂' },
  53: { desc: 'Drizzle', glyph: '☂' },
  55: { desc: 'Heavy drizzle', glyph: '☂' },
  56: { desc: 'Freezing drizzle', glyph: '☂' },
  57: { desc: 'Freezing drizzle', glyph: '☂' },
  61: { desc: 'Light rain', glyph: '☂' },
  63: { desc: 'Rain', glyph: '☂' },
  65: { desc: 'Heavy rain', glyph: '☔' },
  66: { desc: 'Freezing rain', glyph: '☔' },
  67: { desc: 'Freezing rain', glyph: '☔' },
  71: { desc: 'Light snow', glyph: '❄' },
  73: { desc: 'Snow', glyph: '❄' },
  75: { desc: 'Heavy snow', glyph: '❄' },
  77: { desc: 'Snow grains', glyph: '❄' },
  80: { desc: 'Rain showers', glyph: '☂' },
  81: { desc: 'Rain showers', glyph: '☔' },
  82: { desc: 'Violent showers', glyph: '☔' },
  85: { desc: 'Snow showers', glyph: '❄' },
  86: { desc: 'Heavy snow showers', glyph: '❄' },
  95: { desc: 'Thunderstorm', glyph: '⚡' },
  96: { desc: 'Storm with hail', glyph: '⚡' },
  99: { desc: 'Severe storm', glyph: '⚡' },
};

export function describeCode(code: number) {
  return DESCRIPTORS[code] ?? { desc: 'Unknown conditions', glyph: '◎' };
}

/** Browsers still report legacy IANA zone names, which geocode to odd namesakes. */
const CITY_ALIASES: Record<string, string> = {
  Calcutta: 'Kolkata',
  Bombay: 'Mumbai',
  Madras: 'Chennai',
  Saigon: 'Ho Chi Minh City',
  Kiev: 'Kyiv',
  Rangoon: 'Yangon',
  Katmandu: 'Kathmandu',
};

function normalizeCity(name: string): string {
  const trimmed = name.trim();
  return CITY_ALIASES[trimmed] ?? trimmed;
}

export function timezoneCity(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const tail = tz.split('/').pop() || 'London';
    return normalizeCity(tail.replace(/_/g, ' '));
  } catch {
    return 'London';
  }
}

async function geocode(city: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city,
  )}&count=5&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding service unavailable');
  const data = await res.json();
  const results: any[] = data?.results ?? [];
  if (!results.length) return null;
  // Prefer the match in the operator's own timezone when a name is ambiguous.
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hit = results.find((entry) => entry.timezone === localZone) ?? results[0];
  return { name: hit.name, lat: hit.latitude, lon: hit.longitude };
}

export async function loadWeather(cityInput?: string): Promise<WeatherData> {
  const city = normalizeCity(cityInput || timezoneCity());
  const place = await geocode(city);
  if (!place) throw new Error(`I could not locate "${city}".`);

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m` +
    `&wind_speed_unit=kmh&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Weather uplink failed');
  const data = await res.json();
  const current = data?.current;
  if (!current) throw new Error('Weather payload was empty');

  const info = describeCode(Number(current.weather_code));
  return {
    city: place.name,
    tempC: Math.round(Number(current.temperature_2m)),
    feelsC: Math.round(Number(current.apparent_temperature)),
    humidity: Math.round(Number(current.relative_humidity_2m)),
    windKph: Math.round(Number(current.wind_speed_10m)),
    code: Number(current.weather_code),
    desc: info.desc,
    isDay: Boolean(current.is_day),
    updatedAt: Date.now(),
  };
}
