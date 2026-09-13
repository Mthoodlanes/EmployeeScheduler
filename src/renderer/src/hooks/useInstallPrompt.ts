import { useCallback, useEffect, useState } from 'react';

/**
 * The `beforeinstallprompt` event isn't yet in the standard DOM lib types.
 * Android/desktop Chrome (and Chromium-based browsers) fire this once the
 * PWA meets installability criteria; the event must be captured and
 * `.preventDefault()`-ed immediately so its `prompt()` can be triggered
 * later from a real user gesture (a button click) instead of the browser's
 * own default mini-infobar.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function detectIsIos(): boolean {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  const isAppleTouchDevice = /iphone|ipad|ipod/i.test(userAgent);
  // iPadOS 13+ reports its UA as a plain Mac's — only distinguishable from a
  // real Mac by touch support, since a Mac never has a touchscreen.
  const isIpadOs13Plus = platform === 'MacIntel' && maxTouchPoints > 1;
  return isAppleTouchDevice || isIpadOs13Plus;
}

function detectIsStandalone(): boolean {
  const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone;
  return Boolean(navigatorStandalone) || window.matchMedia('(display-mode: standalone)').matches;
}

export interface InstallPromptState {
  /** True once a real Android/desktop-Chrome install prompt is ready to fire. */
  canInstall: boolean;
  /** True on iOS Safari, which never fires `beforeinstallprompt` — needs manual instructions instead. */
  isIos: boolean;
  /** True if already running installed (standalone display mode) — nothing to prompt for. */
  isStandalone: boolean;
  /** Shows the native install prompt. Only meaningful when `canInstall` is true. */
  promptInstall: () => Promise<void>;
}

/** Milestone 25: drives `InstallAppPrompt`'s platform-specific install UI. */
export function useInstallPrompt(): InstallPromptState {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(detectIsStandalone);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = (): void => {
      setDeferredEvent(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<void> => {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    // Whether accepted or dismissed, this specific captured event is spent —
    // Chrome will fire a fresh `beforeinstallprompt` later if applicable.
    setDeferredEvent(null);
  }, [deferredEvent]);

  return {
    canInstall: deferredEvent !== null,
    isIos: detectIsIos(),
    isStandalone,
    promptInstall,
  };
}
