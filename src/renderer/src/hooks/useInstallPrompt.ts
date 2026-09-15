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

/**
 * `beforeinstallprompt` fires identically on Android Chrome and desktop
 * Chrome/Edge — same event, same `canInstall` state — but "install to your
 * home screen" only makes sense on a touch device; a desktop has no home
 * screen. `(pointer: coarse)` is true for a touch-primary device (phone/
 * tablet) and false for a mouse/trackpad-primary one (desktop/laptop,
 * including touchscreen laptops used with a trackpad), which is a better
 * signal here than user-agent sniffing for "is this actually a phone."
 */
function detectIsTouchPrimary(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Chrome only fires `beforeinstallprompt` once its own engagement heuristic
 * is satisfied (return visits, time on site) — on a fresh or infrequent
 * visit `canInstall` can stay false indefinitely even though the browser
 * genuinely supports installing this app. Chromium browsers (Chrome, Edge)
 * always expose a manual install affordance regardless (an icon in the
 * address bar, or a menu item) — this flags those browsers so the desktop
 * install card can stay visible and fall back to pointing at that manual
 * path instead of disappearing while waiting on the heuristic. Firefox and
 * desktop Safari have no install mechanism at all, so they're excluded
 * rather than shown instructions that don't apply.
 */
function detectIsChromiumBased(): boolean {
  const ua = window.navigator.userAgent;
  return /chrome|chromium|edg\//i.test(ua) && !/firefox|fxios/i.test(ua);
}

/**
 * Firefox never implemented `beforeinstallprompt` (Mozilla's own PWA-install
 * story has been inconsistent over the years), so `canInstall` never
 * becomes true here no matter how engaged the visitor is. Detected
 * separately from `isChromiumBased` above rather than folded into an "else"
 * of it, since the two platforms genuinely differ (see `isTouchPrimary`'s
 * use in `InstallAppPrompt`): Firefox for Android has a real, working
 * manual "Add to Home screen"/"Install" menu item worth pointing at, while
 * desktop Firefox has no install feature in its standard release at all —
 * there's nothing accurate to tell a desktop Firefox visitor to click.
 */
function detectIsFirefox(): boolean {
  return /firefox|fxios/i.test(window.navigator.userAgent);
}

export interface InstallPromptState {
  /** True once a real Android/desktop-Chrome install prompt is ready to fire. */
  canInstall: boolean;
  /** True on iOS Safari, which never fires `beforeinstallprompt` — needs manual instructions instead. */
  isIos: boolean;
  /** True on a touch-primary device (phone/tablet) — steers "Install App" copy toward "home screen" vs. desktop wording. */
  isTouchPrimary: boolean;
  /** True on Chrome/Edge — browsers that always have a manual install affordance even before `canInstall` turns true. */
  isChromiumBased: boolean;
  /** True on Firefox (desktop or mobile) — never fires `beforeinstallprompt`; only Android Firefox has a real manual install path to point at. */
  isFirefox: boolean;
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
    isTouchPrimary: detectIsTouchPrimary(),
    isChromiumBased: detectIsChromiumBased(),
    isFirefox: detectIsFirefox(),
    isStandalone,
    promptInstall,
  };
}
