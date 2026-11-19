import { useEffect, useRef, useState } from 'react';
import type { Stats } from '../types';

export function useSystemStats(): Stats {
  const [stats, setStats] = useState<Stats>({
    fps: 60,
    heapMB: null,
    heapLimitMB: null,
    cores: navigator.hardwareConcurrency || 4,
    battery: null,
    charging: false,
    online: navigator.onLine,
    downlink: null,
    rtt: null,
    uptime: 0,
  });

  const frames = useRef(0);
  const last = useRef(performance.now());
  const mounted = useRef(Date.now());

  // FPS sampling loop.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      frames.current += 1;
      const now = performance.now();
      if (now - last.current >= 1000) {
        const fps = Math.round((frames.current * 1000) / (now - last.current));
        frames.current = 0;
        last.current = now;
        setStats((prev) => ({ ...prev, fps: Math.min(fps, 240) }));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Memory + network + uptime.
  useEffect(() => {
    const read = () => {
      const perf = performance as any;
      const mem = perf.memory;
      const conn = (navigator as any).connection;
      setStats((prev) => ({
        ...prev,
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
        heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
        online: navigator.onLine,
        downlink: conn?.downlink ?? null,
        rtt: conn?.rtt ?? null,
        uptime: Math.floor((Date.now() - mounted.current) / 1000),
      }));
    };
    read();
    const id = window.setInterval(read, 2000);
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  // Battery, where supported.
  useEffect(() => {
    let battery: any = null;
    const update = () => {
      if (!battery) return;
      setStats((prev) => ({
        ...prev,
        battery: Math.round(battery.level * 100),
        charging: Boolean(battery.charging),
        online: navigator.onLine,
      }));
    };
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((b: any) => {
        battery = b;
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      });
    }
    return () => {
      if (!battery?.removeEventListener) return;
      battery.removeEventListener('levelchange', update);
      battery.removeEventListener('chargingchange', update);
    };
  }, []);

  return stats;
}
