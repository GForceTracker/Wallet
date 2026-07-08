import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Copy, X } from 'lucide-react';
import { SiBitcoin, SiEthereum, SiTether } from 'react-icons/si';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, TransactionData, SettingsData } from '../api';
import { saveTxToStorage, loadTxFromStorage, mergeTx } from '../txStorage';
import { toast } from 'sonner';

interface AssetDetailsViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

interface ReceiveModalProps {
  address: string | null | undefined;
  symbol: string;
  onClose: () => void;
}

function ReceiveModal({ address, symbol, onClose }: ReceiveModalProps) {
  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      toast.success('Address copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-[430px] bg-card border border-border rounded-3xl p-6 flex flex-col gap-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Receive {symbol}</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {address ? (
          <>
            <p className="text-sm text-muted">Send only {symbol} to this address. Sending any other asset may result in permanent loss.</p>
            <div className="bg-background border border-border rounded-xl p-4 flex flex-col gap-3">
              <span className="text-xs text-muted uppercase tracking-widest font-medium">Deposit Address</span>
              <p className="font-mono text-sm text-foreground break-all leading-relaxed">{address}</p>
            </div>
            <button
              onClick={handleCopy}
              className="w-full bg-primary hover:bg-primary/90 text-background font-medium rounded-xl px-4 py-4 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Copy className="w-5 h-5" />
              Copy Address
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted text-sm">
              No deposit address has been set for {symbol} yet. Please contact support or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function AssetDetailsView({ asset, onNavigate }: AssetDetailsViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [history, setHistory] = useState<TransactionData[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);

  useEffect(() => {
    Promise.all([api.getWallet(), api.getTransactions(), api.getSettings()])
      .then(([w, txs, s]) => {
        setWallet(w);
        setSettings(s);

        // Merge server transactions with localStorage backup
        const local = loadTxFromStorage();
        const merged = mergeTx(txs, local);
        saveTxToStorage(merged);

        setHistory(merged.filter(t => t.asset === asset));
      })
      .catch(() => {
        toast.error('Failed to load data — showing cached history');
        // On network failure: use localStorage so history is visible even offline
        const local = loadTxFromStorage();
        setHistory(local.filter(t => t.asset === asset));
        // Provide stub wallet/settings so the page renders instead of spinning
        setWallet(prev => prev ?? { btc: 0, eth: 0, usdt: 0 });
        setSettings(prev => prev ?? {
          gas_fee_usd: 0, gas_fee_btc: 0,
          btc_price: 0, eth_price: 0, usdt_price: 0,
        });
      })
      .finally(() => setLoading(false));
  }, [asset]);

  const getDepositAddress = () => {
    if (!settings) return null;
    switch (asset) {
      case 'btc': return settings.deposit_address_btc;
      case 'eth': return settings.deposit_address_eth;
      case 'usdt': return settings.deposit_address_usdt;
    }
  };

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prices = { btc: settings.btc_price, eth: settings.eth_price, usdt: settings.usdt_price };
  const balance = wallet[asset];
  const price = prices[asset];
  const fiatVal = balance * price;

  const getAssetDetails = () => {
    switch (asset) {
      case 'btc': return { name: 'Bitcoin', symbol: 'BTC', icon: <div className="bg-[#f7931a]/20 p-4 rounded-full"><SiBitcoin className="text-[#f7931a] w-10 h-10" /></div> };
      case 'eth': return { name: 'Ethereum', symbol: 'ETH', icon: <div className="bg-[#627eea]/20 p-4 rounded-full"><SiEthereum className="text-[#627eea] w-10 h-10" /></div> };
      case 'usdt': return { name: 'Tether', symbol: 'USDT', icon: <div className="bg-[#26a17b]/20 p-4 rounded-full"><SiTether className="text-[#26a17b] w-10 h-10" /></div> };
    }
  };

  const details = getAssetDetails();

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center p-6 pt-10 relative">
          <button
            onClick={() => onNavigate('user-wallet')}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors absolute left-6"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="font-medium text-foreground w-full text-center">{details.name} ({details.symbol})</div>
        </div>

        {/* Asset Info */}
        <div className="flex flex-col items-center justify-center py-6 px-4">
          {details.icon}
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mt-6 mb-1">
            {balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {details.symbol}
          </h1>
          <div className="text-muted text-lg">
            ${fiatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-muted/60 text-xs mt-1">
            1 {details.symbol} = ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} · live price
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-center gap-4 px-6 pb-8">
          <button
            onClick={() => onNavigate('send-withdraw', asset)}
            className="flex-1 bg-primary text-background flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg active:scale-[0.98]"
          >
            <ArrowUpRight className="w-5 h-5" />
            Send
          </button>
          <button
            onClick={() => setShowReceive(true)}
            className="flex-1 bg-card border border-border text-primary flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium hover:bg-card/80 transition-colors active:scale-[0.98]"
          >
            <ArrowDownRight className="w-5 h-5" />
            Receive
          </button>
        </div>

        {/* History */}
        <div className="flex-1 bg-card rounded-t-3xl p-6 border-t border-border flex flex-col">
          <h3 className="text-foreground font-semibold mb-4">Transaction History</h3>

          {history.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted text-sm pb-10">
              No transactions yet
            </div>
          ) : (
            <div className="flex flex-col gap-4 overflow-y-auto pb-6">
              {history.slice().reverse().map((tx) => {
                const isDeposit = tx.type === 'Deposit';
                const isGasFee = tx.type === 'Gas Fee';
                const colorClass = isDeposit
                  ? 'bg-success/10 text-success'
                  : isGasFee
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'bg-destructive/10 text-destructive';
                const textColor = isDeposit ? 'text-success' : 'text-foreground';
                const prefix = isDeposit ? '+' : '-';

                return (
                  <div key={tx.id} className="flex items-center justify-between pb-4 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClass}`}>
                        {isDeposit
                          ? <ArrowDownRight className="w-5 h-5" />
                          : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{tx.type}</div>
                        <div className="text-muted text-xs">{tx.date}</div>
                      </div>
                    </div>
                    <div className={`font-semibold ${textColor}`}>
                      {prefix}{tx.change.toLocaleString(undefined, { maximumFractionDigits: 8 })} {details.symbol}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showReceive && (
        <ReceiveModal
          address={getDepositAddress()}
          symbol={details.symbol}
          onClose={() => setShowReceive(false)}
        />
      )}
    </>
  );
}
