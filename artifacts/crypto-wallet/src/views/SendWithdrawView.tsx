import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType, getBalances, saveBalances, getHistory, saveHistory, Balances, Transaction, GAS_FEE_USD, GAS_FEE_BTC, PRICES } from '../store';
import { toast } from 'sonner';

interface SendWithdrawViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

export function SendWithdrawView({ asset, onNavigate }: SendWithdrawViewProps) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setBalances(getBalances());
  }, []);

  if (!balances) return null;

  const maxAmount = balances[asset];
  
  const handleConfirm = () => {
    setError('');
    
    if (!address.trim()) {
      setError('Please enter a recipient address');
      return;
    }
    
    const withdrawAmount = parseFloat(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (withdrawAmount > maxAmount) {
      setError(`Insufficient ${asset.toUpperCase()} balance`);
      return;
    }

    // Check gas fee
    const requiresGasFromBtc = asset !== 'btc';
    const btcAvailableForGas = asset === 'btc' ? balances.btc - withdrawAmount : balances.btc;

    if (btcAvailableForGas < GAS_FEE_BTC) {
      setError(`Insufficient BTC balance to cover network fees ($${GAS_FEE_USD.toFixed(2)})`);
      return;
    }

    // Process withdrawal
    const newBalances = { ...balances };
    
    // Deduct main amount
    newBalances[asset] -= withdrawAmount;
    
    // Deduct gas fee
    newBalances.btc -= GAS_FEE_BTC;

    saveBalances(newBalances);

    // Save history
    const history = getHistory();
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const newTx: Transaction = {
      asset,
      type: 'Withdrawal',
      change: withdrawAmount,
      date: today
    };
    
    const gasTx: Transaction = {
      asset: 'btc',
      type: 'Gas Fee',
      change: GAS_FEE_BTC,
      date: today
    };

    history.push(newTx, gasTx);
    saveHistory(history);

    toast.success('Withdrawal processed successfully', {
      description: `Sent ${withdrawAmount} ${asset.toUpperCase()}`,
    });

    onNavigate('asset-details', asset);
  };

  const getAssetName = () => {
    switch(asset) {
      case 'btc': return 'Bitcoin (BTC)';
      case 'eth': return 'Ethereum (ETH)';
      case 'usdt': return 'Tether (USDT)';
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
        <div className="flex flex-col gap-2">
          <label className="text-sm text-muted px-1">Asset</label>
          <div className="w-full bg-card/50 border border-border rounded-xl px-4 py-3.5 text-foreground opacity-70 cursor-not-allowed">
            {getAssetName()}
          </div>
        </div>

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

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-sm text-muted">Amount</label>
            <span className="text-xs text-primary font-medium cursor-pointer" onClick={() => setAmount(maxAmount.toString())}>
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
              {asset.toUpperCase()}
            </div>
          </div>
          <div className="text-xs text-muted px-1 flex justify-between">
            <span>Available: {maxAmount > 0 ? maxAmount.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {asset.toUpperCase()}</span>
            <span>~${(parseFloat(amount || '0') * PRICES[asset]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl border border-[#da3637]/30 bg-[#da3637]/10 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex flex-col">
            <div className="text-sm font-medium text-foreground">Network Fee (Gas)</div>
            <div className="text-lg font-semibold text-destructive mt-1 mb-2">
              ${GAS_FEE_USD.toFixed(2)} USD ≈ {GAS_FEE_BTC} BTC
            </div>
            <div className="text-xs text-muted/90 leading-relaxed">
              This fee is required to process your transaction on the blockchain network and will be deducted from your BTC balance.
            </div>
          </div>
        </div>

        {error && (
          <div className="text-destructive text-sm px-1 font-medium mt-auto text-center">{error}</div>
        )}

        <button
          onClick={handleConfirm}
          className="w-full bg-destructive hover:bg-destructive/90 text-white font-medium rounded-xl px-4 py-4 mt-auto transition-colors shadow-[0_0_20px_rgba(218,54,55,0.2)] active:scale-[0.98]"
        >
          Confirm Withdrawal
        </button>
      </div>
    </div>
  );
}
