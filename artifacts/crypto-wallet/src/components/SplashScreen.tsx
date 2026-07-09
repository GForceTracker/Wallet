import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrantLogo } from './TrantLogo';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onComplete, prefersReduced ? 400 : 2600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label="Loading TRANT WALLET"
      className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: prefersReduced ? 0 : 0.45, ease: 'easeOut' }}
    >
      {/* Centre group — fixed size so it never causes layout shift */}
      <div className="flex flex-col items-center gap-6">
        {/* Pulse ring behind the logo */}
        {!prefersReduced && (
          <div className="relative flex items-center justify-center">
            <motion.div
              className="absolute rounded-[24px]"
              style={{ width: 148, height: 148, border: '2px solid var(--color-primary, #0ea5e9)' }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.35, 1], opacity: [0, 0.18, 0] }}
              transition={{ delay: 0.5, duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.div
              initial={{ scale: prefersReduced ? 1 : 0.65, opacity: prefersReduced ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: prefersReduced ? 0 : 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <TrantLogo size={108} />
            </motion.div>
          </div>
        )}

        {prefersReduced && <TrantLogo size={108} />}

        {/* Word-mark */}
        <motion.div
          initial={{ opacity: prefersReduced ? 1 : 0, y: prefersReduced ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReduced ? 0 : 0.28, duration: prefersReduced ? 0 : 0.45, ease: 'easeOut' }}
          className="flex flex-col items-center gap-[4px]"
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

        {/* Loading dots */}
        {!prefersReduced && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex gap-[7px] items-center mt-2"
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
      </div>
    </motion.div>
  );
}
