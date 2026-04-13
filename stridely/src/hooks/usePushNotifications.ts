import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// iOS Safari requires Uint8Array; Chrome accepts raw string but Uint8Array works everywhere
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output.buffer;
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed';

interface UsePushNotificationsReturn {
  status: PushStatus;
  subscribe: (athleteId?: string, todaySession?: { type: string; distance: string } | null) => Promise<void>;
  unsubscribe: () => Promise<void>;
  loading: boolean;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [status, setStatus] = useState<PushStatus>('unsubscribed');
  const [loading, setLoading] = useState(false);

  // Detectar estado inicial — si ya hay suscripción activa, re-registrarla en el servidor
  // (cubre el caso de reinicio del servidor que pierde las suscripciones en memoria)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setStatus('subscribed');
        // Re-register to server silently — handles server restarts
        fetch(`${API_BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub }),
        }).catch(() => { /* silent — non-critical */ });
      } else {
        setStatus('unsubscribed');
      }
    }).catch(() => setStatus('unsubscribed'));
  }, []);

  const subscribe = useCallback(async (
    athleteId?: string,
    todaySession?: { type: string; distance: string } | null
  ) => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'unsubscribed');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, athleteId, todaySession }),
      });

      setStatus('subscribed');
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
      // Permission may have been granted but PushManager.subscribe failed (e.g. network).
      // Re-check actual permission so the banner reflects reality.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // Try to recover: check if a subscription already exists from a prior attempt
        try {
          const reg = await navigator.serviceWorker.ready;
          const existing = await reg.pushManager.getSubscription();
          setStatus(existing ? 'subscribed' : 'unsubscribed');
        } catch {
          setStatus('unsubscribed');
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      setStatus('unsubscribed');
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { status, subscribe, unsubscribe, loading };
}
