import React, { useEffect, useState } from 'react';
import { LogOut, Save, Trash2, Zap, Users, Settings, ChevronDown, ChevronUp, UserCircle, DollarSign, Clock, CheckCircle, XCircle, KeyRound, X, AlertCircle, Plus } from 'lucide-react';
import { api, WalletData, SettingsData, UserWithWallet, PendingWithdrawalData } from '../api';
import { toast } from 'sonner';

interface AdminViewProps {
  onLogout: () => void;
}

type Tab = 'users' | 'withdrawals' | 'settings' | 'danger';

const ASSET_KEYS = ['btc', 'eth', 'usdt_trc20', 'usdt_bep20', 'usdt_erc20', 'trx'] as const;
type AssetKey = typeof ASSET_KEYS[number];

const ASSET_LABELS: Record<AssetKey, string> = {
  btc: 'Bitcoin (BTC)',
  eth: 'Ethereum (ETH)',
  usdt_trc20: 'USDT TRC20',
  usdt_bep20: 'USDT BEP20',
  usdt_erc20: 'USDT ERC20',
  trx: 'Tron (TRX)',
};

const ASSET_SYMBOLS: Record<AssetKey, string> = {
  btc: 'BTC', eth: 'ETH',
  usdt_trc20: 'USDT', usdt_bep20: 'USDT', usdt_erc20: 'USDT',
  trx: 'TRX',
};

const ASSET_DECIMALS: Record<AssetKey, number> = {
  btc: 8, eth: 6, usdt_trc20: 4, usdt_bep20: 4, usdt_erc20: 4, trx: 2,
};

interface Prices {
  btc_price: number;
  eth_price: number;
  usdt_price: number;
  trx_price: number;
}

function getPriceForAsset(key: AssetKey, p: Prices): number {
  switch (key) {
    case 'btc': return p.btc_price;
    case 'eth': return p.eth_price;
    case 'usdt_trc20':
    case 'usdt_bep20':
    case 'usdt_erc20': return p.usdt_price;
    case 'trx': return p.trx_price;
  }
}

function usdToCoin(usd: number, key: AssetKey, prices: Prices): number {
  const price = getPriceForAsset(key, prices);
  if (!price || !usd) return 0;
  return usd / price;
}

function coinToUsd(coin: number, key: AssetKey, prices: Prices): number {
  return coin * getPriceForAsset(key, prices);
}

function emptyUsd(): Record<AssetKey, string> {
  return { btc: '', eth: '', usdt_trc20: '', usdt_bep20: '', usdt_erc20: '', trx: '' };
}

function walletToUsd(w: WalletData | null, prices: Prices): Record<AssetKey, string> {
  if (!w) return emptyUsd();
  const fmt = (coin: number, key: AssetKey) => {
    const usd = coinToUsd(coin, key, prices);
    return usd > 0 ? usd.toFixed(2) : '';
  };
  return {
    btc: fmt(w.btc, 'btc'),
    eth: fmt(w.eth, 'eth'),
    usdt_trc20: fmt(w.usdt_trc20, 'usdt_trc20'),
    usdt_bep20: fmt(w.usdt_bep20, 'usdt_bep20'),
    usdt_erc20: fmt(w.usdt_erc20, 'usdt_erc20'),
    trx: fmt(w.trx, 'trx'),
  };
}

function networkFeesToInputs(w: WalletData | null | undefined): Record<AssetKey, string> {
  const get = (k: AssetKey) => {
    const v = w?.[`network_fee_${k}` as keyof WalletData] as number | null | undefined;
    return v != null ? String(v) : '';
  };
  return {
    btc: get('btc'), eth: get('eth'),
    usdt_trc20: get('usdt_trc20'), usdt_bep20: get('usdt_bep20'), usdt_erc20: get('usdt_erc20'),
    trx: get('trx'),
  };
}

function withdrawalChargesToInputs(w: WalletData | null | undefined): Record<AssetKey, string> {
  const get = (k: AssetKey) => {
    const v = w?.[`withdrawal_charge_${k}` as keyof WalletData] as number | null | undefined;
    return v != null && v > 0 ? String(v) : '';
  };
  return {
    btc: get('btc'), eth: get('eth'),
    usdt_trc20: get('usdt_trc20'), usdt_bep20: get('usdt_bep20'), usdt_erc20: get('usdt_erc20'),
    trx: get('trx'),
  };
}

function assetLabel(asset: string): string {
  const map: Record<string, string> = {
    btc: 'BTC', eth: 'ETH',
    usdt_trc20: 'USDT TRC20', usdt_bep20: 'USDT BEP20', usdt_erc20: 'USDT ERC20',
    trx: 'TRX',
  };
  return map[asset] ?? asset.toUpperCase();
}

// ── Reset Password Modal ───────────────────────────────────────────────────────

function ResetPasswordModal({ userId, username, onClose }: {
  userId: number; username: string; onClose: () => void;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.adminResetPassword(userId, newPassword);
      toast.success(`Password reset for ${username}`);
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-[380px] bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Reset Password</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted">Set a new password for <span className="text-foreground font-medium">{username}</span>.</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted font-medium">New Password</label>
          <input
            type="text"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
            placeholder="Min 6 characters"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border border-border text-muted rounded-xl py-3 text-sm font-medium hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-60 text-background rounded-xl py-3 text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm/Reject Withdrawal Modal ───────────────────────────────────────────

function WithdrawalActionModal({
  withdrawal, action, onClose, onDone,
}: {
  withdrawal: PendingWithdrawalData & { username: string };
  action: 'confirm' | 'reject';
  onClose: () => void;
  onDone: () => void;
}) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (action === 'reject' && !message.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setSaving(true);
    try {
      if (action === 'confirm') {
        await api.adminConfirmWithdrawal(withdrawal.id, message.trim() || undefined);
        toast.success(`Withdrawal confirmed for ${withdrawal.username}`);
      } else {
        await api.adminRejectWithdrawal(withdrawal.id, message.trim());
        toast.success(`Withdrawal rejected for ${withdrawal.username}`);
      }
      onDone();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const isConfirm = action === 'confirm';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className={`w-full max-w-[380px] bg-card border rounded-3xl p-6 flex flex-col gap-5 shadow-2xl ${
        isConfirm ? 'border-success/30' : 'border-destructive/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
              isConfirm ? 'bg-success/15' : 'bg-destructive/15'
            }`}>
              {isConfirm
                ? <CheckCircle className="w-5 h-5 text-success" />
                : <XCircle className="w-5 h-5 text-destructive" />
              }
            </div>
            <h2 className="text-base font-bold text-foreground">
              {isConfirm ? 'Confirm Withdrawal' : 'Reject Withdrawal'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-background/60 border border-border rounded-xl p-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">User</span>
            <span className="font-medium text-foreground">{withdrawal.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Asset</span>
            <span className="font-medium text-foreground">{assetLabel(withdrawal.asset)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Amount</span>
            <span className="font-medium text-foreground">{withdrawal.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {assetLabel(withdrawal.asset)}</span>
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            <span className="text-muted text-xs">To Address</span>
            <span className="font-mono text-xs text-foreground break-all">{withdrawal.address}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted font-medium">
            {isConfirm ? 'Message (optional)' : 'Reason for rejection (required)'}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm resize-none"
            placeholder={isConfirm
              ? 'e.g. Your withdrawal has been processed successfully.'
              : 'e.g. Withdrawal rejected due to suspicious activity.'
            }
            rows={3}
            autoFocus
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border border-border text-muted rounded-xl py-3 text-sm font-medium hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex-1 disabled:opacity-60 text-white rounded-xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
              isConfirm ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'
            }`}
          >
            {saving ? 'Processing…' : isConfirm ? 'Confirm' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UserRow({ user, prices, onSaved }: {
  user: UserWithWallet;
  prices: Prices;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [usdInputs, setUsdInputs] = useState<Record<AssetKey, string>>(
    walletToUsd(user.wallet, prices)
  );
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [togglingWithdrawal, setTogglingWithdrawal] = useState(false);
  const [depositInputs, setDepositInputs] = useState<Record<AssetKey, string>>(
    { btc: '', eth: '', usdt_trc20: '', usdt_bep20: '', usdt_erc20: '', trx: '' }
  );
  const [depositingKey, setDepositingKey] = useState<AssetKey | null>(null);
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(
    user.wallet?.withdrawal_enabled ?? false
  );
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [feeInputs, setFeeInputs] = useState<Record<AssetKey, string>>(
    networkFeesToInputs(user.wallet)
  );
  const [savingFees, setSavingFees] = useState(false);
  const [chargeInputs, setChargeInputs] = useState<Record<AssetKey, string>>(
    withdrawalChargesToInputs(user.wallet)
  );
  const [savingCharges, setSavingCharges] = useState(false);

  const isEnvAdmin = user.id === -1;

  const handleToggleWithdrawal = async () => {
    if (isEnvAdmin) return;
    setTogglingWithdrawal(true);
    try {
      const res = await api.adminToggleWithdrawal(user.id);
      setWithdrawalEnabled(res.withdrawal_enabled);
      toast.success(res.withdrawal_enabled
        ? `Withdrawals enabled for ${user.username}`
        : `Withdrawals disabled for ${user.username}`
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update withdrawal status');
    } finally {
      setTogglingWithdrawal(false);
    }
  };

  const coinAmounts: Record<AssetKey, number> = {} as Record<AssetKey, number>;
  for (const key of ASSET_KEYS) {
    const usd = parseFloat(usdInputs[key]);
    coinAmounts[key] = isNaN(usd) ? 0 : usdToCoin(usd, key, prices);
  }

  const handleSave = async () => {
    if (isEnvAdmin) return;
    setSaving(true);
    try {
      await api.adminUpdateUserWallet(user.id, {
        btc: coinAmounts.btc,
        eth: coinAmounts.eth,
        usdt_trc20: coinAmounts.usdt_trc20,
        usdt_bep20: coinAmounts.usdt_bep20,
        usdt_erc20: coinAmounts.usdt_erc20,
        trx: coinAmounts.trx,
      });
      toast.success(`Wallet updated for ${user.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update wallet');
    } finally {
      setSaving(false);
    }
  };

  const handleDeposit = async (key: AssetKey) => {
    const raw = depositInputs[key];
    const amount = parseFloat(raw);
    if (!raw || isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount to deposit');
      return;
    }
    setDepositingKey(key);
    try {
      await api.adminDepositCrypto(user.id, key, amount);
      setDepositInputs(prev => ({ ...prev, [key]: '' }));
      toast.success(`Deposited ${amount.toLocaleString(undefined, { maximumFractionDigits: ASSET_DECIMALS[key] })} ${ASSET_SYMBOLS[key]} to ${user.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositingKey(null);
    }
  };

  const handleSaveFees = async () => {
    if (isEnvAdmin) return;
    setSavingFees(true);
    try {
      const parsed: Record<AssetKey, number | null> = {} as Record<AssetKey, number | null>;
      for (const key of ASSET_KEYS) {
        const raw = feeInputs[key].trim();
        if (raw === '') { parsed[key] = null; continue; }
        const n = parseFloat(raw);
        if (isNaN(n) || n < 0) {
          toast.error(`Enter a valid fee for ${ASSET_LABELS[key]}, or leave it blank to use the default`);
          setSavingFees(false);
          return;
        }
        parsed[key] = n;
      }
      await api.adminUpdateNetworkFees(user.id, {
        network_fee_btc: parsed.btc,
        network_fee_eth: parsed.eth,
        network_fee_usdt_trc20: parsed.usdt_trc20,
        network_fee_usdt_bep20: parsed.usdt_bep20,
        network_fee_usdt_erc20: parsed.usdt_erc20,
        network_fee_trx: parsed.trx,
      });
      toast.success(`Network fee requirements updated for ${user.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update network fees');
    } finally {
      setSavingFees(false);
    }
  };

  const handleSaveCharges = async () => {
    if (isEnvAdmin) return;
    setSavingCharges(true);
    try {
      const parsed: Record<AssetKey, number | null> = {} as Record<AssetKey, number | null>;
      for (const key of ASSET_KEYS) {
        const raw = chargeInputs[key].trim();
        if (raw === '') { parsed[key] = null; continue; }
        const n = parseFloat(raw);
        if (isNaN(n) || n < 0) {
          toast.error(`Enter a valid charge for ${ASSET_LABELS[key]}, or leave it blank for no charge`);
          setSavingCharges(false);
          return;
        }
        parsed[key] = n;
      }
      await api.adminUpdateWithdrawalCharges(user.id, {
        withdrawal_charge_btc: parsed.btc,
        withdrawal_charge_eth: parsed.eth,
        withdrawal_charge_usdt_trc20: parsed.usdt_trc20,
        withdrawal_charge_usdt_bep20: parsed.usdt_bep20,
        withdrawal_charge_usdt_erc20: parsed.usdt_erc20,
        withdrawal_charge_trx: parsed.trx,
      });
      toast.success(`Withdrawal charges updated for ${user.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update withdrawal charges');
    } finally {
      setSavingCharges(false);
    }
  };

  const handleWipe = async () => {
    if (isEnvAdmin) return;
    setWiping(true);
    try {
      await api.adminDeleteUserTransactions(user.id);
      setConfirmWipe(false);
      toast.success(`Transaction history cleared for ${user.username}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setWiping(false);
    }
  };

  const totalUsd = user.wallet
    ? coinToUsd(user.wallet.btc, 'btc', prices)
    + coinToUsd(user.wallet.eth, 'eth', prices)
    + coinToUsd(user.wallet.usdt_trc20, 'usdt_trc20', prices)
    + coinToUsd(user.wallet.usdt_bep20, 'usdt_bep20', prices)
    + coinToUsd(user.wallet.usdt_erc20, 'usdt_erc20', prices)
    + coinToUsd(user.wallet.trx, 'trx', prices)
    : 0;

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <button
          onClick={() => !isEnvAdmin && setOpen(v => !v)}
          className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${!isEnvAdmin ? 'hover:bg-background/40 active:scale-[0.99]' : 'cursor-default'}`}
        >
          <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
            {user.profile_photo ? (
              <img src={user.profile_photo} alt={user.username} className="w-full h-full object-cover" />
            ) : isEnvAdmin ? (
              <UserCircle className="w-5 h-5 text-primary" />
            ) : (
              <span className="text-xs font-bold text-primary">#{user.id}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm flex items-center gap-2 flex-wrap">
              {user.username}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${
                user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
              }`}>
                {user.role === 'admin' ? 'Admin' : 'User'}
              </span>
              {isEnvAdmin && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted/30 text-muted uppercase">ENV</span>
              )}
            </div>
            {!isEnvAdmin && (
              <div className="text-xs text-muted mt-0.5">
                {totalUsd > 0
                  ? `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total`
                  : 'Empty wallet'}
              </div>
            )}
            {isEnvAdmin && <div className="text-xs text-muted mt-0.5">Environment admin — no wallet</div>}
          </div>

          {!isEnvAdmin && (
            <div className="text-muted shrink-0">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          )}
        </button>

        {open && !isEnvAdmin && (
          <div className="px-4 pb-5 border-t border-border/60 pt-4 flex flex-col gap-4 bg-background/30">

            {/* ── Withdrawal Enable Toggle ── */}
            <button
              onClick={handleToggleWithdrawal}
              disabled={togglingWithdrawal}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors ${
                withdrawalEnabled
                  ? 'border-success/40 bg-success/10'
                  : 'border-destructive/30 bg-destructive/5'
              }`}
            >
              <div className="text-left">
                <div className={`text-sm font-semibold ${withdrawalEnabled ? 'text-success' : 'text-destructive'}`}>
                  {withdrawalEnabled ? 'Withdrawals Enabled' : 'Withdrawals Disabled'}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {withdrawalEnabled
                    ? 'User can submit withdrawal requests'
                    : 'User cannot withdraw — toggle to approve'}
                </div>
              </div>
              <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${
                withdrawalEnabled ? 'bg-success' : 'bg-destructive/40'
              } ${togglingWithdrawal ? 'opacity-50' : ''}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  withdrawalEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </div>
            </button>

            {/* ── Reset Password ── */}
            <button
              onClick={() => setShowResetPassword(true)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-background/60 transition-colors"
            >
              <div className="text-left">
                <div className="text-sm font-semibold text-foreground">Reset Password</div>
                <div className="text-xs text-muted mt-0.5">Set a new password for this user</div>
              </div>
              <KeyRound className="w-4 h-4 text-muted shrink-0" />
            </button>

            {/* ── Fund Wallet ── */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">Fund Wallet</span>
              <span className="text-[10px] text-muted bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                Enter in USD — auto-converts
              </span>
            </div>

            {ASSET_KEYS.map(key => {
              const coinVal = coinAmounts[key];
              const currentCoin = user.wallet ? (user.wallet[key as keyof WalletData] as number) : 0;
              const currentUsd = coinToUsd(currentCoin, key, prices);
              const decimals = ASSET_DECIMALS[key];
              const depositAmt = parseFloat(depositInputs[key]);
              const depositUsd = !isNaN(depositAmt) && depositAmt > 0
                ? coinToUsd(depositAmt, key, prices)
                : 0;
              const isDepositing = depositingKey === key;
              return (
                <div key={key} className="flex flex-col gap-1.5 pb-2 border-b border-border/40 last:border-0 last:pb-0">
                  <label className="text-xs text-foreground font-medium flex justify-between">
                    <span>{ASSET_LABELS[key]}</span>
                    {currentCoin > 0 && (
                      <span className="text-muted">
                        Now: {currentCoin.toLocaleString(undefined, { maximumFractionDigits: decimals })} {ASSET_SYMBOLS[key]}
                        {' '}(${currentUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })})
                      </span>
                    )}
                  </label>

                  {/* Set total (USD) */}
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">$</span>
                    <input
                      type="number"
                      value={usdInputs[key]}
                      onChange={e => setUsdInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                      placeholder="Set total (USD)"
                      step="any"
                      min="0"
                    />
                  </div>
                  {usdInputs[key] !== '' && parseFloat(usdInputs[key]) > 0 && (
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-xs text-success font-medium">
                        ≈ {coinVal.toLocaleString(undefined, { maximumFractionDigits: decimals })} {ASSET_SYMBOLS[key]}
                      </span>
                      <span className="text-xs text-muted">
                        @ ${getPriceForAsset(key, prices).toLocaleString(undefined, { maximumFractionDigits: 2 })}/{ASSET_SYMBOLS[key]}
                      </span>
                    </div>
                  )}

                  {/* Quick deposit (crypto amount) */}
                  <div className="flex gap-2 mt-0.5">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={depositInputs[key]}
                        onChange={e => setDepositInputs(prev => ({ ...prev, [key]: e.target.value }))}
                        className="w-full bg-background border border-success/30 rounded-xl pl-3.5 pr-4 py-2.5 text-foreground focus:outline-none focus:border-success transition-colors text-sm placeholder:text-muted/60"
                        placeholder={`+ Add ${ASSET_SYMBOLS[key]}`}
                        step="any"
                        min="0"
                      />
                    </div>
                    <button
                      onClick={() => handleDeposit(key)}
                      disabled={isDepositing || !depositInputs[key] || parseFloat(depositInputs[key]) <= 0}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-success/15 hover:bg-success/25 disabled:opacity-40 text-success border border-success/30 rounded-xl text-xs font-semibold transition-colors shrink-0 active:scale-[0.97]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {isDepositing ? 'Adding…' : 'Deposit'}
                    </button>
                  </div>
                  {depositInputs[key] !== '' && depositAmt > 0 && (
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-xs text-success font-medium">
                        +{depositAmt.toLocaleString(undefined, { maximumFractionDigits: decimals })} {ASSET_SYMBOLS[key]}
                      </span>
                      <span className="text-xs text-muted">
                        ≈ ${depositUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} @ live rate
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-3.5 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] mt-1"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save & Send Deposit Notification'}
            </button>

            {/* ── Per-User Withdrawal Charges ── */}
            <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Withdrawal Charges</span>
                <span className="text-[10px] text-muted bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Per-user
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed -mt-1">
                Set a fee (in the asset's native units) automatically deducted from this user's balance when a withdrawal is confirmed. Leave blank for no charge.
              </p>

              {ASSET_KEYS.map(key => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs text-foreground font-medium w-24 shrink-0">{ASSET_LABELS[key]}</label>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={chargeInputs[key]}
                      onChange={e => setChargeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl pl-3.5 pr-14 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                      placeholder="No charge"
                      step="any"
                      min="0"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted text-xs font-medium">{ASSET_SYMBOLS[key]}</span>
                  </div>
                </div>
              ))}

              <button
                onClick={handleSaveCharges}
                disabled={savingCharges}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <DollarSign className="w-4 h-4" />
                {savingCharges ? 'Saving…' : 'Save Withdrawal Charges'}
              </button>
            </div>

            {/* ── Per-User Network Fee Requirements ── */}
            <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Network Fee Requirements</span>
                <span className="text-[10px] text-muted bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  Per-user override
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed -mt-1">
                Set a custom network fee (USD) required from this user before withdrawing each asset. Leave blank to fall back to the global default in Settings.
              </p>

              {ASSET_KEYS.map(key => (
                <div key={key} className="flex items-center gap-2">
                  <label className="text-xs text-foreground font-medium w-24 shrink-0">{ASSET_SYMBOLS[key]}</label>
                  <div className="relative flex-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">$</span>
                    <input
                      type="number"
                      value={feeInputs[key]}
                      onChange={e => setFeeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                      placeholder="Use default"
                      step="any"
                      min="0"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={handleSaveFees}
                disabled={savingFees}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <DollarSign className="w-4 h-4" />
                {savingFees ? 'Saving…' : 'Save Network Fee Requirements'}
              </button>
            </div>

            <div className="border-t border-border/60 pt-3">
              {!confirmWipe ? (
                <button
                  onClick={() => setConfirmWipe(true)}
                  className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Transaction History
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmWipe(false)}
                    className="flex-1 border border-border text-muted rounded-xl py-3 text-sm font-medium transition-colors hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWipe}
                    disabled={wiping}
                    className="flex-1 bg-destructive hover:bg-destructive/90 disabled:opacity-60 text-white rounded-xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {wiping ? 'Clearing…' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showResetPassword && (
        <ResetPasswordModal
          userId={user.id}
          username={user.username}
          onClose={() => setShowResetPassword(false)}
        />
      )}
    </>
  );
}

// ── Withdrawals Tab ───────────────────────────────────────────────────────────

function WithdrawalsTab({ onRefresh }: { onRefresh: () => void }) {
  const [withdrawals, setWithdrawals] = useState<(PendingWithdrawalData & { username: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionModal, setActionModal] = useState<{
    withdrawal: PendingWithdrawalData & { username: string };
    action: 'confirm' | 'reject';
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('pending');

  const loadWithdrawals = () => {
    setLoading(true);
    api.adminGetWithdrawals()
      .then(data => setWithdrawals(data))
      .catch(() => toast.error('Failed to load withdrawal requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWithdrawals(); }, []);

  const filtered = withdrawals.filter(w => filter === 'all' || w.status === filter);
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500/20 text-amber-400',
    confirmed: 'bg-success/20 text-success',
    rejected: 'bg-destructive/20 text-destructive',
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Filter tabs */}
        <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
          {(['pending', 'confirmed', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f ? 'bg-primary text-background' : 'text-muted hover:text-foreground'
              }`}
            >
              {f}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            {filtered.length} Request{filtered.length !== 1 ? 's' : ''}
          </span>
          <button onClick={loadWithdrawals} className="text-xs text-muted hover:text-foreground transition-colors">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted text-sm py-10">
            No {filter === 'all' ? '' : filter} withdrawal requests
          </div>
        ) : (
          filtered.map(w => (
            <div key={w.id} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground text-sm">{w.username}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase ${statusColors[w.status] ?? 'bg-muted/20 text-muted'}`}>
                      {w.status}
                    </span>
                  </div>
                  <span className="text-xs text-muted">{new Date(w.created_at).toLocaleString()}</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-foreground">
                    {w.amount.toLocaleString(undefined, { maximumFractionDigits: 8 })} {assetLabel(w.asset)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-widest">To Address</span>
                <span className="font-mono text-xs text-foreground break-all leading-relaxed">{w.address}</span>
              </div>

              {w.admin_message && (
                <div className="bg-background/60 border border-border/60 rounded-xl px-3 py-2 text-xs text-muted">
                  <span className="font-medium text-foreground">Message: </span>{w.admin_message}
                </div>
              )}

              {w.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setActionModal({ withdrawal: w, action: 'reject' })}
                    className="flex-1 border border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => setActionModal({ withdrawal: w, action: 'confirm' })}
                    className="flex-1 bg-success hover:bg-success/90 text-white rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirm
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {actionModal && (
        <WithdrawalActionModal
          withdrawal={actionModal.withdrawal}
          action={actionModal.action}
          onClose={() => setActionModal(null)}
          onDone={() => {
            setActionModal(null);
            loadWithdrawals();
            onRefresh();
          }}
        />
      )}
    </>
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function CoinEquivRow({ usdStr, assetKey, assetSymbol, price }: {
  usdStr: string; assetKey: AssetKey; assetSymbol: string; price: number;
}) {
  const usd = parseFloat(usdStr);
  if (!usd || usd <= 0 || !price) return null;
  const isStable = assetKey.startsWith('usdt');
  const coin = isStable ? usd : usd / price;
  const decimals = ASSET_DECIMALS[assetKey];
  return (
    <span className="text-xs text-primary font-medium">
      ≈ {coin.toLocaleString(undefined, { maximumFractionDigits: decimals })} {assetSymbol}
    </span>
  );
}

function UserFeeManager({ users, onSaved }: { users: UserWithWallet[]; onSaved: () => void }) {
  const selectableUsers = users.filter(u => u.id !== -1 && u.wallet);
  const [selectedId, setSelectedId] = useState<number | null>(selectableUsers[0]?.id ?? null);
  const selectedUser = selectableUsers.find(u => u.id === selectedId) ?? null;

  const [feeInputs, setFeeInputs] = useState<Record<AssetKey, string>>(
    networkFeesToInputs(selectedUser?.wallet)
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFeeInputs(networkFeesToInputs(selectedUser?.wallet));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleSave = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const parsed: Record<AssetKey, number | null> = {} as Record<AssetKey, number | null>;
      for (const key of ASSET_KEYS) {
        const raw = feeInputs[key].trim();
        if (raw === '') { parsed[key] = null; continue; }
        const n = parseFloat(raw);
        if (isNaN(n) || n < 0) {
          toast.error(`Enter a valid fee for ${ASSET_LABELS[key]}, or leave it blank for no fee`);
          setSaving(false);
          return;
        }
        parsed[key] = n;
      }
      await api.adminUpdateNetworkFees(selectedUser.id, {
        network_fee_btc: parsed.btc,
        network_fee_eth: parsed.eth,
        network_fee_usdt_trc20: parsed.usdt_trc20,
        network_fee_usdt_bep20: parsed.usdt_bep20,
        network_fee_usdt_erc20: parsed.usdt_erc20,
        network_fee_trx: parsed.trx,
      });
      toast.success(`Withdrawal fees updated for ${selectedUser.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update withdrawal fees');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader label="Withdrawal Fees" />
      <p className="text-xs text-muted -mt-3">
        Withdrawal fees are set per user — there is no site-wide default. Select a user below to view or set the fee they must pay before withdrawing each asset. Leave a field blank for no fee.
      </p>

      <select
        value={selectedId ?? ''}
        onChange={e => setSelectedId(e.target.value ? parseInt(e.target.value, 10) : null)}
        className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
      >
        {selectableUsers.length === 0 && <option value="">No users yet</option>}
        {selectableUsers.map(u => (
          <option key={u.id} value={u.id}>{u.username}</option>
        ))}
      </select>

      {selectedUser && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-card">
          {ASSET_KEYS.map(key => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-xs text-foreground font-medium w-24 shrink-0">{ASSET_SYMBOLS[key]}</label>
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm font-medium">$</span>
                <input
                  type="number"
                  value={feeInputs[key]}
                  onChange={e => setFeeInputs(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full bg-background border border-border rounded-xl pl-8 pr-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                  placeholder="No fee"
                  step="any"
                  min="0"
                />
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <DollarSign className="w-4 h-4" />
            {saving ? 'Saving…' : `Save Fees for ${selectedUser.username}`}
          </button>
        </div>
      )}
    </div>
  );
}

function SettingsTab({ settings, onSaved, users, onUsersRefresh }: {
  settings: SettingsData;
  onSaved: (s: SettingsData) => void;
  users: UserWithWallet[];
  onUsersRefresh: () => void;
}) {
  const [addresses, setAddresses] = useState({
    deposit_address_btc: settings.deposit_address_btc ?? '',
    deposit_address_eth: settings.deposit_address_eth ?? '',
    deposit_address_usdt_trc20: settings.deposit_address_usdt_trc20 ?? '',
    deposit_address_usdt_bep20: settings.deposit_address_usdt_bep20 ?? '',
    deposit_address_usdt_erc20: settings.deposit_address_usdt_erc20 ?? '',
    deposit_address_trx: settings.deposit_address_trx ?? '',
  });
  const [autoApprove, setAutoApprove] = useState(settings.auto_approve ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        deposit_address_btc: addresses.deposit_address_btc.trim() || null,
        deposit_address_eth: addresses.deposit_address_eth.trim() || null,
        deposit_address_usdt_trc20: addresses.deposit_address_usdt_trc20.trim() || null,
        deposit_address_usdt_bep20: addresses.deposit_address_usdt_bep20.trim() || null,
        deposit_address_usdt_erc20: addresses.deposit_address_usdt_erc20.trim() || null,
        deposit_address_trx: addresses.deposit_address_trx.trim() || null,
        auto_approve: autoApprove,
      });
      onSaved(updated);
      toast.success('Settings saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addressFields: { label: string; key: keyof typeof addresses; placeholder: string }[] = [
    { label: 'BTC Deposit Address', key: 'deposit_address_btc', placeholder: 'bc1q…' },
    { label: 'ETH Deposit Address', key: 'deposit_address_eth', placeholder: '0x…' },
    { label: 'USDT TRC20 Deposit Address', key: 'deposit_address_usdt_trc20', placeholder: 'T…' },
    { label: 'USDT BEP20 Deposit Address', key: 'deposit_address_usdt_bep20', placeholder: '0x…' },
    { label: 'USDT ERC20 Deposit Address', key: 'deposit_address_usdt_erc20', placeholder: '0x…' },
    { label: 'TRX Deposit Address', key: 'deposit_address_trx', placeholder: 'T…' },
  ];

  return (
    <div className="flex flex-col gap-5">

      <UserFeeManager users={users} onSaved={onUsersRefresh} />

      <SectionHeader label="Deposit Addresses" className="mt-2" />
      {addressFields.map(({ label, key, placeholder }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label className="text-sm text-foreground font-medium">{label}</label>
          <input
            type="text"
            value={addresses[key]}
            onChange={e => setAddresses(prev => ({ ...prev, [key]: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
            placeholder={placeholder}
          />
        </div>
      ))}

      <SectionHeader label="Transaction Mode" className="mt-2" />
      <button
        onClick={() => setAutoApprove(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${
          autoApprove ? 'border-primary/40 bg-primary/10' : 'border-border bg-card'
        }`}
      >
        <div className="flex items-center gap-3">
          <Zap className={`w-5 h-5 ${autoApprove ? 'text-primary' : 'text-muted'}`} />
          <div className="text-left">
            <div className={`text-sm font-medium ${autoApprove ? 'text-primary' : 'text-foreground'}`}>
              Auto-Approve Withdrawals
            </div>
            <div className="text-xs text-muted mt-0.5">
              {autoApprove ? 'Gas fee step is skipped' : 'Users must confirm gas fee payment'}
            </div>
          </div>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${autoApprove ? 'bg-primary' : 'bg-border'}`}>
          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${autoApprove ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </div>
      </button>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-4 mt-2 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        <Save className="w-5 h-5" />
        {saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}

// ── Main AdminView ────────────────────────────────────────────────────────────

export function AdminView({ onLogout }: AdminViewProps) {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserWithWallet[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wipingAll, setWipingAll] = useState(false);
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);

  const loadData = () => {
    return Promise.all([api.getUsers(), api.getSettings()])
      .then(([u, s]) => { setUsers(u); setSettings(s); })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleWipeAll = async () => {
    setWipingAll(true);
    try {
      await api.deleteAllTransactions();
      setConfirmWipeAll(false);
      toast.success('All transaction history cleared');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setWipingAll(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prices: Prices = {
    btc_price: settings.btc_price,
    eth_price: settings.eth_price,
    usdt_price: settings.usdt_price,
    trx_price: settings.trx_price,
  };

  return (
    <div className="flex flex-col h-full bg-background pb-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col px-6 pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-foreground mb-0.5">Admin Panel</h1>
        <p className="text-muted text-sm">Manage users, balances, and settings</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mx-6 mb-5 bg-card border border-border rounded-xl p-1">
        {([
          { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
          { id: 'withdrawals', label: 'Withdrawals', icon: <Clock className="w-4 h-4" /> },
          { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
          { id: 'danger', label: 'Danger', icon: <Trash2 className="w-4 h-4" /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-medium transition-colors ${
              tab === id
                ? id === 'danger' ? 'bg-destructive text-white' : 'bg-primary text-background'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="px-6 flex flex-col gap-4">

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                {users.length} User{users.length !== 1 ? 's' : ''}
              </span>
              <button onClick={loadData} className="text-xs text-muted hover:text-foreground transition-colors">
                Refresh
              </button>
            </div>
            {/* Live price strip */}
            <div className="flex items-center gap-3 px-3 py-2 bg-card border border-border rounded-xl overflow-x-auto">
              <DollarSign className="w-3.5 h-3.5 text-muted shrink-0" />
              {([
                { label: 'BTC', price: prices.btc_price },
                { label: 'ETH', price: prices.eth_price },
                { label: 'USDT', price: prices.usdt_price },
                { label: 'TRX', price: prices.trx_price },
              ]).map(({ label, price }) => (
                <span key={label} className="text-xs text-muted whitespace-nowrap shrink-0">
                  <span className="text-foreground font-medium">{label}</span>{' '}
                  ${price.toLocaleString(undefined, { maximumFractionDigits: label === 'BTC' || label === 'ETH' ? 0 : 4 })}
                </span>
              ))}
            </div>
            {users.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">No users yet</div>
            ) : (
              users.map(u => (
                <UserRow key={u.id} user={u} prices={prices} onSaved={loadData} />
              ))
            )}
          </>
        )}

        {/* ── Withdrawals Tab ── */}
        {tab === 'withdrawals' && (
          <WithdrawalsTab onRefresh={loadData} />
        )}

        {/* ── Settings Tab ── */}
        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            onSaved={s => setSettings(s)}
            users={users}
            onUsersRefresh={loadData}
          />
        )}

        {/* ── Danger Tab ── */}
        {tab === 'danger' && (
          <div className="flex flex-col gap-4">
            <SectionHeader label="Danger Zone" danger />
            <p className="text-xs text-muted -mt-3">These actions are permanent and cannot be undone.</p>

            {!confirmWipeAll ? (
              <button
                onClick={() => setConfirmWipeAll(true)}
                className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10 font-medium rounded-xl px-4 py-3.5 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear ALL Transaction History
              </button>
            ) : (
              <div className="flex flex-col gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
                <p className="text-sm text-foreground font-medium text-center">
                  This will permanently delete ALL transaction records for ALL users. Are you sure?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmWipeAll(false)}
                    className="flex-1 border border-border text-muted hover:text-foreground rounded-xl py-3 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWipeAll}
                    disabled={wipingAll}
                    className="flex-1 bg-destructive hover:bg-destructive/90 disabled:opacity-60 text-white rounded-xl py-3 font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    {wipingAll ? 'Clearing…' : 'Yes, Clear All'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 pt-6 mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3.5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors rounded-xl active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout Admin</span>
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label, className = '', danger = false }: {
  label: string; className?: string; danger?: boolean;
}) {
  return (
    <div className={`mb-1 ${className}`}>
      <span className={`text-xs font-semibold uppercase tracking-widest ${danger ? 'text-destructive' : 'text-primary'}`}>
        {label}
      </span>
    </div>
  );
}
