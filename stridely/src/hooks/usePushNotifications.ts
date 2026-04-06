import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

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

  // Detectar estado inicial
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    // Comprobar si ya hay una suscripción activa
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription()
    ).then((sub) => {
      setStatus(sub ? 'subscribed' : 'unsubscribed');
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
        applicationServerKey: VAPID_PUBLIC_KEY,
      });

      await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, athleteId, todaySession }),
      });

      setStatus('subscribed');
    } catch (err) {
      console.error('[Push] Subscribe error:', err);
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
