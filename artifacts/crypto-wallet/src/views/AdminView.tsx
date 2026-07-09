import React, { useEffect, useState } from 'react';
import { LogOut, Save, Trash2, Zap, Users, Settings, ChevronDown, ChevronUp, UserCircle } from 'lucide-react';
import { api, WalletData, SettingsData, UserWithWallet } from '../api';
import { toast } from 'sonner';

interface AdminViewProps {
  onLogout: () => void;
}

type Tab = 'users' | 'settings' | 'danger';

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

function emptyBal(): Record<AssetKey, string> {
  return { btc: '0', eth: '0', usdt_trc20: '0', usdt_bep20: '0', usdt_erc20: '0', trx: '0' };
}

function walletToBal(w: WalletData | null): Record<AssetKey, string> {
  if (!w) return emptyBal();
  return {
    btc: w.btc.toString(),
    eth: w.eth.toString(),
    usdt_trc20: w.usdt_trc20.toString(),
    usdt_bep20: w.usdt_bep20.toString(),
    usdt_erc20: w.usdt_erc20.toString(),
    trx: w.trx.toString(),
  };
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UserRow({ user, onSaved }: { user: UserWithWallet; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [bal, setBal] = useState<Record<AssetKey, string>>(walletToBal(user.wallet));
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const isEnvAdmin = user.id === -1;

  const handleSave = async () => {
    if (isEnvAdmin) return;
    setSaving(true);
    try {
      await api.adminUpdateUserWallet(user.id, {
        btc: parseFloat(bal.btc) || 0,
        eth: parseFloat(bal.eth) || 0,
        usdt_trc20: parseFloat(bal.usdt_trc20) || 0,
        usdt_bep20: parseFloat(bal.usdt_bep20) || 0,
        usdt_erc20: parseFloat(bal.usdt_erc20) || 0,
        trx: parseFloat(bal.trx) || 0,
      });
      toast.success(`Wallet updated for ${user.username}`);
      onSaved();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update wallet');
    } finally {
      setSaving(false);
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

  const totalBal = user.wallet
    ? user.wallet.btc + user.wallet.eth + user.wallet.usdt_trc20 + user.wallet.usdt_bep20 + user.wallet.usdt_erc20 + user.wallet.trx
    : 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => !isEnvAdmin && setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-4 text-left transition-colors ${!isEnvAdmin ? 'hover:bg-background/40 active:scale-[0.99]' : 'cursor-default'}`}
      >
        {/* ID badge */}
        <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
          {isEnvAdmin ? (
            <UserCircle className="w-5 h-5 text-primary" />
          ) : (
            <span className="text-xs font-bold text-primary">#{user.id}</span>
          )}
        </div>

        {/* Info */}
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
          {!isEnvAdmin && user.wallet && (
            <div className="text-xs text-muted mt-0.5">
              {totalBal > 0 ? `${user.wallet.btc > 0 ? `${user.wallet.btc.toLocaleString(undefined, { maximumFractionDigits: 6 })} BTC` : ''}${user.wallet.eth > 0 ? ` · ${user.wallet.eth.toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH` : ''}`.trim() || 'Has balances' : 'Empty wallet'}
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
          <div className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">Fund Wallet</div>

          {ASSET_KEYS.map(key => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs text-foreground font-medium flex justify-between">
                <span>{ASSET_LABELS[key]}</span>
                {user.wallet && (
                  <span className="text-muted">Current: {(user.wallet[key as keyof WalletData] as number).toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>
                )}
              </label>
              <input
                type="number"
                value={bal[key]}
                onChange={e => setBal(prev => ({ ...prev, [key]: e.target.value }))}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                step="any" min="0"
              />
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-3.5 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] mt-1"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save & Send Notification'}
          </button>

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
  );
}

// ── Settings Tab ──────────────────────────────────────────────────────────────

function SettingsTab({ settings, onSaved }: { settings: SettingsData; onSaved: (s: SettingsData) => void }) {
  const [fees, setFees] = useState({
    gas_fee_usd: settings.gas_fee_usd.toString(),
    gas_fee_btc: settings.gas_fee_btc.toString(),
  });
  const [addresses, setAddresses] = useState({
    deposit_address_btc: settings.deposit_address_btc ?? '',
    deposit_address_eth: settings.deposit_address_eth ?? '',
    deposit_address_usdt_trc20: settings.deposit_address_usdt_trc20 ?? '',
    deposit_address_usdt_bep20: settings.deposit_address_usdt_bep20 ?? '',
    deposit_address_usdt_erc20: settings.deposit_address_usdt_erc20 ?? '',
    deposit_address_trx: settings.deposit_address_trx ?? '',
  });
  const [withdrawalFees, setWithdrawalFees] = useState({
    withdrawal_fee_btc: (settings.withdrawal_fee_btc ?? 0).toString(),
    withdrawal_fee_eth: (settings.withdrawal_fee_eth ?? 0).toString(),
    withdrawal_fee_usdt_trc20: (settings.withdrawal_fee_usdt_trc20 ?? 0).toString(),
    withdrawal_fee_usdt_bep20: (settings.withdrawal_fee_usdt_bep20 ?? 0).toString(),
    withdrawal_fee_usdt_erc20: (settings.withdrawal_fee_usdt_erc20 ?? 0).toString(),
    withdrawal_fee_trx: (settings.withdrawal_fee_trx ?? 0).toString(),
  });
  const [autoApprove, setAutoApprove] = useState(settings.auto_approve ?? false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        gas_fee_usd: parseFloat(fees.gas_fee_usd) || 0,
        gas_fee_btc: parseFloat(fees.gas_fee_btc) || 0,
        deposit_address_btc: addresses.deposit_address_btc.trim() || null,
        deposit_address_eth: addresses.deposit_address_eth.trim() || null,
        deposit_address_usdt_trc20: addresses.deposit_address_usdt_trc20.trim() || null,
        deposit_address_usdt_bep20: addresses.deposit_address_usdt_bep20.trim() || null,
        deposit_address_usdt_erc20: addresses.deposit_address_usdt_erc20.trim() || null,
        deposit_address_trx: addresses.deposit_address_trx.trim() || null,
        withdrawal_fee_btc: parseFloat(withdrawalFees.withdrawal_fee_btc) || 0,
        withdrawal_fee_eth: parseFloat(withdrawalFees.withdrawal_fee_eth) || 0,
        withdrawal_fee_usdt_trc20: parseFloat(withdrawalFees.withdrawal_fee_usdt_trc20) || 0,
        withdrawal_fee_usdt_bep20: parseFloat(withdrawalFees.withdrawal_fee_usdt_bep20) || 0,
        withdrawal_fee_usdt_erc20: parseFloat(withdrawalFees.withdrawal_fee_usdt_erc20) || 0,
        withdrawal_fee_trx: parseFloat(withdrawalFees.withdrawal_fee_trx) || 0,
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

  const withdrawalFeeFields: { label: string; key: keyof typeof withdrawalFees }[] = [
    { label: 'BTC Withdrawal Fee (USD)', key: 'withdrawal_fee_btc' },
    { label: 'ETH Withdrawal Fee (USD)', key: 'withdrawal_fee_eth' },
    { label: 'USDT TRC20 Withdrawal Fee (USD)', key: 'withdrawal_fee_usdt_trc20' },
    { label: 'USDT BEP20 Withdrawal Fee (USD)', key: 'withdrawal_fee_usdt_bep20' },
    { label: 'USDT ERC20 Withdrawal Fee (USD)', key: 'withdrawal_fee_usdt_erc20' },
    { label: 'TRX Withdrawal Fee (USD)', key: 'withdrawal_fee_trx' },
  ];

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
      {/* Per-coin withdrawal fees */}
      <SectionHeader label="Withdrawal Fees (per coin)" />
      <p className="text-xs text-muted -mt-3">Set individual network fees per coin in USD. Set to 0 to use the global gas fee.</p>

      {withdrawalFeeFields.map(({ label, key }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <label className="text-sm text-foreground font-medium">{label}</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
            <input
              type="number"
              value={withdrawalFees[key]}
              onChange={e => setWithdrawalFees(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              step="any" min="0"
            />
          </div>
        </div>
      ))}

      {/* Global gas fee (fallback) */}
      <SectionHeader label="Global Gas Fee (Fallback)" className="mt-2" />
      <p className="text-xs text-muted -mt-3">Used when per-coin fee above is set to 0.</p>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground font-medium flex justify-between">
          <span>Gas Fee (USD)</span>
          <span className="text-muted text-xs">Current: ${settings.gas_fee_usd.toFixed(2)}</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
          <input
            type="number"
            value={fees.gas_fee_usd}
            onChange={e => setFees(prev => ({ ...prev, gas_fee_usd: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            step="any" min="0"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-foreground font-medium flex justify-between">
          <span>Gas Fee (BTC)</span>
          <span className="text-muted text-xs">Current: {settings.gas_fee_btc}</span>
        </label>
        <input
          type="number"
          value={fees.gas_fee_btc}
          onChange={e => setFees(prev => ({ ...prev, gas_fee_btc: e.target.value }))}
          className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
          step="any" min="0"
        />
      </div>

      {/* Deposit addresses */}
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

      {/* Auto-approve */}
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
          { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
          { id: 'danger', label: 'Danger', icon: <Trash2 className="w-4 h-4" /> },
        ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? id === 'danger' ? 'bg-destructive text-white' : 'bg-primary text-background'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {icon}
            {label}
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
              <button
                onClick={loadData}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Refresh
              </button>
            </div>
            {users.length === 0 ? (
              <div className="text-center text-muted text-sm py-8">No users yet</div>
            ) : (
              users.map(u => (
                <UserRow key={u.id} user={u} onSaved={loadData} />
              ))
            )}
          </>
        )}

        {/* ── Settings Tab ── */}
        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            onSaved={(s) => setSettings(s)}
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

function SectionHeader({ label, className = '', danger = false }: { label: string; className?: string; danger?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 mb-1 ${className}`}>
      <span className={`text-xs font-semibold uppercase tracking-widest ${danger ? 'text-destructive' : 'text-primary'}`}>
        {label}
      </span>
    </div>
  );
}
