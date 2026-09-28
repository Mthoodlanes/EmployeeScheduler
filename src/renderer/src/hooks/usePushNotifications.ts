import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * VAPID public keys arrive from the server as the standard base64url string
 * `web-push`'s `generateVAPIDKeys()` produces — `PushManager.subscribe`'s
 * `applicationServerKey` option requires a raw `Uint8Array` instead, so this
 * is the standard conversion (base64url alphabet, `-`/`_` swapped back to
 * `+`/`/`, then padded to a multiple of 4) copied by every Web Push guide.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function subscriptionToRequest(subscription: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = subscription.toJSON();
  if (!json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('Push subscription is missing its encryption keys.');
  }
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export type PushSupportState = 'checking' | 'unsupported' | 'ios-not-installed' | 'supported';

export interface PushNotificationsState {
  /** Whether this browser/device can even attempt Web Push right now — see `PushSupportState`. */
  supportState: PushSupportState;
  /** Mirrors `Notification.permission`; only meaningful once `supportState` is `'supported'`. */
  permission: NotificationPermission;
  /** Null while the initial subscription check is still in flight. */
  isSubscribed: boolean | null;
  isLoading: boolean;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Drives the Settings page's notification opt-in. Deliberately excludes the
 * Electron shell entirely: `main.tsx` never registers a service worker
 * there (see its own comment on `isElectronShell`), so
 * `navigator.serviceWorker.ready` would hang forever waiting for a
 * registration that's never coming. Callers should also check
 * `window.api` themselves and skip rendering this UI inside the shell —
 * this hook only guards its own async work, not the whole component.
 */
export function usePushNotifications(): PushNotificationsState {
  const [supportState, setSupportState] = useState<PushSupportState>('checking');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const isElectronShell = Boolean(window.api);
    const hasPushApis =
      !isElectronShell &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    if (!hasPushApis) {
      setSupportState('unsupported');
      return;
    }

    // iOS only fires push events for a PWA installed to the home screen
    // (standalone display mode) — the same APIs are present in a plain
    // mobile Safari tab, but `pushManager.subscribe()` rejects there, so
    // this is checked up front rather than surfaced as a confusing error
    // after the fact. Same UA/standalone detection as `useInstallPrompt`.
    const { userAgent, platform, maxTouchPoints } = window.navigator;
    const isIos = /iphone|ipad|ipod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
    const isStandalone =
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;

    if (isIos && !isStandalone) {
      setSupportState('ios-not-installed');
      return;
    }

    setSupportState('supported');
    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setIsSubscribed(subscription !== null))
      .catch(() => setIsSubscribed(false));
  }, []);

  const subscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        setError(
          'Notifications were blocked. Enable them for this site in your browser settings to turn this on.',
        );
        return;
      }

      const { publicKey } = await api.push.vapidPublicKey();
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await api.push.subscribe(subscriptionToRequest(subscription));
      setIsSubscribed(true);
    } catch {
      setError('Could not turn on notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await api.push.unsubscribe({ endpoint: subscription.endpoint });
      }
      setIsSubscribed(false);
    } catch {
      setError('Could not turn off notifications. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { supportState, permission, isSubscribed, isLoading, error, subscribe, unsubscribe };
}
