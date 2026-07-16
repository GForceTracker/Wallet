import React, { useEffect, useState } from 'react';
import { X, Download, Share } from 'lucide-react';

const PWA_DISMISSED_KEY = 'trant_pwa_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already installed in standalone mode — never show
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Already dismissed by the user
    if (localStorage.getItem(PWA_DISMISSED_KEY)) return;

    const ua = window.navigator.userAgent;
    const isIOSDevice = /iphone|ipad|ipod/i.test(ua);

    if (isIOSDevice) {
      // iOS has no install prompt — guide the user manually via Share sheet
      setIsIOS(true);
      setShowBanner(true);
      return;
    }

    // Chrome / Android — wait for the browser install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    localStorage.setItem(PWA_DISMISSED_KEY, '1');
    setShowBanner(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-50 p-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/icon-192.png" className="w-10 h-10 rounded-xl shrink-0" alt="TRANT" />
            <div>
              <div className="font-semibold text-foreground text-sm">Add to Home Screen</div>
              <div className="text-xs text-muted mt-0.5">Install TRANT Wallet for quick access</div>
            </div>
          </div>
          <button onClick={dismiss} className="p-1 text-muted hover:text-foreground transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          /* iOS: no automatic prompt exists — show manual Share sheet instructions */
          <div className="flex items-center gap-2.5 bg-background/60 border border-border/60 rounded-xl px-3 py-3">
            <Share className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted leading-relaxed">
              Tap <span className="font-semibold text-foreground">Share</span>
              {' '}at the bottom of Safari, then tap{' '}
              <span className="font-semibold text-foreground">Add to Home Screen</span>
            </span>
          </div>
        ) : (
          <button
            onClick={install}
            className="w-full bg-primary hover:bg-primary/90 text-background font-medium rounded-xl py-3 text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            Install App
          </button>
        )}
      </div>
    </div>
  );
}
