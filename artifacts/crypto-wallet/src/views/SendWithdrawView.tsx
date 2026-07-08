import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle, ShieldCheck } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, SettingsData } from '../api';
import { saveTxToStorage, loadTxFromStorage } from '../txStorage';
import { toast } from 'sonner';

interface SendWithdrawViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

export function SendWithdrawView({ asset, onNavigate }: SendWithdrawViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  // Two-step: user must confirm gas fee before sending
  const [gasFeeConfirmed, setGasFeeConfirmed] = useState(false);

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => { setWallet(w); setSettings(s); })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxAmount = wallet[asset];
  const prices = { btc: settings.btc_price, eth: settings.eth_price, usdt: settings.usdt_price };

  const getAssetName = () => {
    switch (asset) {
      case 'btc': return 'Bitcoin (BTC)';
      case 'eth': return 'Ethereum (ETH)';
      case 'usdt': return 'Tether (USDT)';
    }
  };

  const handleRequestConfirm = () => {
    setError('');
    if (!address.trim()) { setError('Please enter a recipient address'); return; }
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) { setError('Please enter a valid amount'); return; }
    if (withdrawAmount > maxAmount) { setError(`Insufficient ${asset.toUpperCase()} balance`); return; }
    // Show the gas fee confirmation step
    setGasFeeConfirmed(false);
    setSubmitting(false);
    // jump to confirmation
    setGasFeeConfirmed(true);
  };

  // This is called only after the user has ticked "I accept gas fee"
  const handleFinalSend = async () => {
    setSubmitting(true);
    setError('');
    const withdrawAmount = parseFloat(amount);
    try {
      const updated = await api.sendWithdraw(asset, withdrawAmount, address.trim());

      // Persist new transactions to localStorage
      const txs = await api.getTransactions().catch(() => []);
      const local = loadTxFromStorage();
      const merged = txs.length >= local.length ? txs : local;
      saveTxToStorage(merged);

      toast.success('Withdrawal processed successfully', {
        description: `Sent ${withdrawAmount} ${asset.toUpperCase()} · gas fee deducted from BTC`,
      });
      onNavigate('asset-details', asset);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg);
      setGasFeeConfirmed(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center p-6 pt-10 relative">
        <button
          onClick={() => onNavigate('asset-details', asset)}
          className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="font-medium text-foreground w-full text-center">Send Crypto</div>
      </div>

      <div className="flex flex-col flex-1 px-6 py-4 gap-6 overflow-y-auto">
        {/* Asset */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted px-1">Asset</label>
          <div className="w-full bg-card/50 border border-border rounded-xl px-4 py-3.5 text-foreground opacity-70 cursor-not-allowed">
            {getAssetName()}
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted px-1">Recipient Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => { setAddress(e.target.value); setGasFeeConfirmed(false); }}
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
              onClick={() => { setAmount(maxAmount.toString()); setGasFeeConfirmed(false); }}
            >
              Max
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setGasFeeConfirmed(false); }}
              className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors text-lg"
              placeholder="0.00"
              step="any"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-medium">
              {asset.toUpperCase()}
            </div>
          </div>
          <div className="text-xs text-muted px-1 flex justify-between">
            <span>Available: {maxAmount > 0 ? maxAmount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {asset.toUpperCase()}</span>
            <span>~${(parseFloat(amount || '0') * prices[asset]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Gas fee notice — always visible */}
        <div className="mt-2 p-4 rounded-xl border border-[#da3637]/30 bg-[#da3637]/10 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <div className="text-sm font-medium text-foreground">Network Fee (Gas) — deducted first</div>
            <div className="text-lg font-semibold text-destructive mt-1 mb-2">
              ${settings.gas_fee_usd.toFixed(2)} USD ≈ {settings.gas_fee_btc} BTC
            </div>
            <div className="text-xs text-muted/90 leading-relaxed">
              This fee is deducted from your BTC balance <strong>before</strong> your withdrawal is processed. Your BTC must cover this fee in addition to any BTC you are sending.
            </div>
          </div>
        </div>

        {/* Gas fee acknowledgement — must accept before sending */}
        {!gasFeeConfirmed && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
              onChange={(e) => {
                if (e.target.checked) handleRequestConfirm();
              }}
            />
            <span className="text-sm text-muted leading-relaxed">
              I understand the network fee of <span className="text-destructive font-medium">${settings.gas_fee_usd.toFixed(2)}</span> will be deducted from my BTC balance first, before my withdrawal is processed.
            </span>
          </label>
        )}

        {/* After gas fee accepted — show final confirmation */}
        {gasFeeConfirmed && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex gap-3">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium text-foreground">Ready to send</div>
              <div className="text-xs text-muted">
                Gas fee of <span className="text-destructive font-medium">{settings.gas_fee_btc} BTC</span> will be deducted first, then{' '}
                <span className="text-primary font-medium">{parseFloat(amount || '0').toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset.toUpperCase()}</span> sent to the recipient.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm px-1 font-medium text-center">{error}</div>
        )}

        <button
          onClick={gasFeeConfirmed ? handleFinalSend : handleRequestConfirm}
          disabled={submitting || !gasFeeConfirmed}
          className="w-full bg-destructive hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-auto transition-colors shadow-[0_0_20px_rgba(218,54,55,0.2)] active:scale-[0.98]"
        >
          {submitting ? 'Processing…' : gasFeeConfirmed ? 'Confirm & Send' : 'Accept Fee to Continue'}
        </button>
      </div>
    </div>
  );
}
