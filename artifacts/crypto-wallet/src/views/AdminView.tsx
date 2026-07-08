import React, { useEffect, useState } from 'react';
import { LogOut, Save, Trash2 } from 'lucide-react';
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

  // Editable fields
  const [bal, setBal] = useState({ btc: '', eth: '', usdt: '' });
  const [fees, setFees] = useState({ gas_fee_usd: '', gas_fee_btc: '' });
  const [addresses, setAddresses] = useState({
    deposit_address_btc: '',
    deposit_address_eth: '',
    deposit_address_usdt: '',
  });

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => {
        setWallet(w);
        setSettings(s);
        setBal({ btc: w.btc.toString(), eth: w.eth.toString(), usdt: w.usdt.toString() });
        setFees({ gas_fee_usd: s.gas_fee_usd.toString(), gas_fee_btc: s.gas_fee_btc.toString() });
        setAddresses({
          deposit_address_btc: s.deposit_address_btc ?? '',
          deposit_address_eth: s.deposit_address_eth ?? '',
          deposit_address_usdt: s.deposit_address_usdt ?? '',
        });
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
          usdt: parseFloat(bal.usdt) || 0,
        }),
        api.updateSettings({
          gas_fee_usd: parseFloat(fees.gas_fee_usd) || 0,
          gas_fee_btc: parseFloat(fees.gas_fee_btc) || 0,
          deposit_address_btc: addresses.deposit_address_btc.trim() || null,
          deposit_address_eth: addresses.deposit_address_eth.trim() || null,
          deposit_address_usdt: addresses.deposit_address_usdt.trim() || null,
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
        <p className="text-muted text-sm">Manage wallet balances, settings and deposit addresses</p>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-5">

        {/* ── Balances ───────────────────────────────────── */}
        <div className="flex flex-col gap-1 mb-1">
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Balances</span>
        </div>

        {([
          { label: 'Bitcoin (BTC)', key: 'btc', current: wallet.btc },
          { label: 'Ethereum (ETH)', key: 'eth', current: wallet.eth },
          { label: 'Tether (USDT)', key: 'usdt', current: wallet.usdt },
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

        {/* ── Deposit Addresses ──────────────────────────── */}
        <div className="flex flex-col gap-1 mt-3 mb-1">
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Deposit Addresses</span>
        </div>
        <p className="text-xs text-muted -mt-3">Shown to users when they tap "Receive"</p>

        {([
          { label: 'BTC Deposit Address', key: 'deposit_address_btc', placeholder: 'bc1q…' },
          { label: 'ETH Deposit Address', key: 'deposit_address_eth', placeholder: '0x…' },
          { label: 'USDT Deposit Address', key: 'deposit_address_usdt', placeholder: '0x… or T…' },
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

        {/* ── Gas Fee ────────────────────────────────────── */}
        <div className="flex flex-col gap-1 mt-3 mb-1">
          <span className="text-xs text-primary font-semibold uppercase tracking-widest">Network Gas Fee</span>
        </div>

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
              step="any"
              min="0"
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
            step="any"
            min="0"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-primary hover:bg-primary/90 disabled:opacity-60 text-background font-medium rounded-xl px-4 py-4 mt-4 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving…' : 'Save Changes'}
        </button>

        {/* ── Danger Zone ────────────────────────────────── */}
        <div className="flex flex-col gap-1 mt-3 mb-1">
          <span className="text-xs text-destructive font-semibold uppercase tracking-widest">Danger Zone</span>
        </div>

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
