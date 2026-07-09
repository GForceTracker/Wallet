import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrantLogo } from './TrantLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    // Respect reduced-motion: skip straight to the app after a brief pause
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onComplete, prefersReduced ? 400 : 2600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    // absolute inset-0 keeps the overlay INSIDE the phone card container
    // (which already has overflow:hidden + relative), so it never bleeds
    // onto the desktop surround.
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Loading TRANT WALLET"
      className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.45, ease: 'easeOut' }}
    >
      {/* Logo mark */}
      <motion.div
        initial={{ scale: prefersReduced ? 1 : 0.65, opacity: prefersReduced ? 1 : 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.34, 1.56, 0.64, 1] }}
        className="mb-8"
      >
        <TrantLogo size={108} />
      </motion.div>

      {/* Word-mark */}
      <motion.div
        initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: prefersReduced ? 0 : 0.28, duration: prefersReduced ? 0 : 0.45, ease: 'easeOut' }}
        className="flex flex-col items-center gap-[3px]"
      >
        <span
          className="text-[28px] font-black tracking-[0.28em] text-foreground"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          TRANT
        </span>
        <span className="text-[11px] font-semibold tracking-[0.55em] text-muted uppercase">
          WALLET
        </span>
      </motion.div>

      {/* Pulse ring — skipped for reduced-motion */}
      {!prefersReduced && (
        <motion.div
          className="absolute"
          style={{ top: '50%', transform: 'translateY(-50%) translateY(-88px)' }}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: [1, 1.35, 1], opacity: [0, 0.18, 0] }}
          transition={{ delay: 0.5, duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
        >
          <div
            className="rounded-[20px]"
            style={{
              width: 140,
              height: 140,
              border: '2px solid var(--color-primary, #0ea5e9)',
            }}
          />
        </motion.div>
      )}

      {/* Loading dots — skipped for reduced-motion */}
      {!prefersReduced && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="absolute bottom-14 flex gap-[7px] items-center"
        >
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="block w-[6px] h-[6px] rounded-full"
              style={{ background: 'var(--color-primary, #0ea5e9)' }}
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.15, 0.8] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}
