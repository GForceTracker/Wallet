import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Copy, X, Clock, AlertCircle } from 'lucide-react';
import { SiBitcoin, SiEthereum, SiTether } from 'react-icons/si';

const TrxIcon = ({ size = 24 }: { size?: number }) => (
  <img
    src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa/svg/color/trx.svg"
    width={size}
    height={size}
    alt="TRX"
  />
);

import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, TransactionData, SettingsData, PendingWithdrawalData } from '../api';
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
    navigator.clipboard.writeText(address)
      .then(() => toast.success('Address copied to clipboard'))
      .catch(() => toast.error('Failed to copy'));
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
            <p className="text-sm text-muted">
              Send only {symbol} to this address. Sending any other asset may result in permanent loss.
            </p>
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

// Unified history item for display
interface HistoryItem {
  id: string;
  type: string;
  change: number;
  date: string;
  status?: string;
  message?: string | null;
  isPending?: boolean;
  isRejected?: boolean;
}

export function AssetDetailsView({ asset, onNavigate }: AssetDetailsViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);

  const loadData = () => {
    return Promise.all([
      api.getWallet(),
      api.getTransactions(),
      api.getSettings(),
      api.getUserWithdrawals().catch(() => [] as PendingWithdrawalData[]),
    ]).then(([w, txs, s, pending]) => {
      setWallet(w);
      setSettings(s);

      const local = loadTxFromStorage();
      const merged = mergeTx(txs, local);
      saveTxToStorage(merged);

      // Build unified history for this asset
      const txItems: HistoryItem[] = merged
        .filter(t => t.asset === asset)
        .map(t => ({
          id: `tx-${t.id}`,
          type: t.type,
          change: t.change,
          date: t.date,
          message: t.message,
          isRejected: t.type === 'Withdrawal Rejected',
        }));

      // Add pending/confirmed/rejected withdrawals for this asset that aren't already in txs
      const pendingItems: HistoryItem[] = pending
        .filter(p => p.asset === asset && p.status === 'pending')
        .map(p => ({
          id: `pw-${p.id}`,
          type: 'Withdrawal',
          change: p.amount,
          date: new Date(p.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
          status: 'pending',
          isPending: true,
        }));

      // Merge and sort by id (pending goes at the end)
      const allItems = [...txItems, ...pendingItems];
      setHistory(allItems);
    }).catch(() => {
      toast.error('Failed to load data — showing cached history');
      const local = loadTxFromStorage();
      setHistory(local.filter(t => t.asset === asset).map(t => ({
        id: `tx-${t.id}`,
        type: t.type,
        change: t.change,
        date: t.date,
        message: t.message,
      })));
      setWallet(prev => prev ?? { btc: 0, eth: 0, usdt_trc20: 0, usdt_bep20: 0, usdt_erc20: 0, trx: 0 });
      setSettings(prev => prev ?? {
        gas_fee_usd: 0, gas_fee_btc: 0,
        btc_price: 0, eth_price: 0, usdt_price: 0, trx_price: 0,
        auto_approve: false,
      });
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [asset]);

  // Refresh prices, wallet and pending withdrawals every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      api.getSettings().then(s => setSettings(s)).catch(() => {});
      // Re-run full data load to pick up confirmed/rejected transitions
      loadData();
    }, 15_000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset]);

  const getDepositAddress = () => {
    if (!settings) return null;
    switch (asset) {
      case 'btc': return settings.deposit_address_btc;
      case 'eth': return settings.deposit_address_eth;
      case 'usdt_trc20': return settings.deposit_address_usdt_trc20;
      case 'usdt_bep20': return settings.deposit_address_usdt_bep20;
      case 'usdt_erc20': return settings.deposit_address_usdt_erc20;
      case 'trx': return settings.deposit_address_trx;
    }
  };

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prices: Record<AssetType, number> = {
    btc: settings.btc_price,
    eth: settings.eth_price,
    usdt_trc20: settings.usdt_price,
    usdt_bep20: settings.usdt_price,
    usdt_erc20: settings.usdt_price,
    trx: settings.trx_price,
  };

  const isUsdt = asset === 'usdt_trc20' || asset === 'usdt_bep20' || asset === 'usdt_erc20';
  const balance = wallet[asset];
  const price = prices[asset];
  const fiatVal = balance * price;

  const getAssetDetails = () => {
    switch (asset) {
      case 'btc': return {
        name: 'Bitcoin', symbol: 'BTC',
        icon: <div className="bg-[#f7931a]/20 p-3.5 rounded-full"><SiBitcoin className="text-[#f7931a] w-8 h-8" /></div>,
      };
      case 'eth': return {
        name: 'Ethereum', symbol: 'ETH',
        icon: <div className="bg-[#627eea]/20 p-3.5 rounded-full"><SiEthereum className="text-[#627eea] w-8 h-8" /></div>,
      };
      case 'usdt_trc20': return {
        name: 'Tether', symbol: 'USDT TRC20',
        icon: <div className="bg-[#26a17b]/20 p-3.5 rounded-full"><SiTether className="text-[#26a17b] w-8 h-8" /></div>,
      };
      case 'usdt_bep20': return {
        name: 'Tether', symbol: 'USDT BEP20',
        icon: <div className="bg-[#26a17b]/20 p-3.5 rounded-full"><SiTether className="text-[#26a17b] w-8 h-8" /></div>,
      };
      case 'usdt_erc20': return {
        name: 'Tether', symbol: 'USDT ERC20',
        icon: <div className="bg-[#26a17b]/20 p-3.5 rounded-full"><SiTether className="text-[#26a17b] w-8 h-8" /></div>,
      };
      case 'trx': return {
        name: 'Tron', symbol: 'TRX',
        icon: <div className="bg-[#ef0027]/20 p-3.5 rounded-full"><TrxIcon size={32} /></div>,
      };
    }
  };

  const details = getAssetDetails();

  /** Truncate to 5 decimal places without rounding (chop off digits 6+) */
  const truncate5 = (n: number) => Math.trunc(n * 1e5) / 1e5;

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
        <div className="flex flex-col items-center justify-center py-4 px-4">
          {details.icon}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mt-4 mb-1 text-center leading-tight">
            {balance > 0 ? (
              <>
                <span className="block">{truncate5(balance).toLocaleString(undefined, { maximumFractionDigits: 5 })}</span>
                <span className="block text-lg font-medium">{details.symbol}</span>
              </>
            ) : (
              <span>0 {details.symbol}</span>
            )}
          </h1>
          <div className="text-muted text-base">
            ${fiatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-muted/60 text-xs mt-1">
            1 {isUsdt ? 'USDT' : details.symbol} = ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })} · live price
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
              {[...history].reverse().map((tx) => {
                const isDeposit = tx.type === 'Deposit';
                const isGasFee = tx.type === 'Gas Fee';
                const isPending = tx.isPending;
                const isRejected = tx.isRejected || tx.type === 'Withdrawal Rejected';

                let colorClass = 'bg-destructive/10 text-destructive';
                let textColor = 'text-foreground';
                let prefix = '-';

                if (isDeposit) {
                  colorClass = 'bg-success/10 text-success';
                  textColor = 'text-success';
                  prefix = '+';
                } else if (isGasFee) {
                  colorClass = 'bg-amber-500/10 text-amber-400';
                } else if (isPending) {
                  colorClass = 'bg-amber-500/10 text-amber-400';
                  textColor = 'text-amber-400';
                } else if (isRejected) {
                  colorClass = 'bg-muted/20 text-muted';
                  textColor = 'text-muted';
                }

                const displayLabel = isPending ? 'Pending' : isRejected ? 'Rejected' : tx.type;

                return (
                  <div key={tx.id} className="flex flex-col pb-4 border-b border-border/50 last:border-0 gap-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                          {isPending ? (
                            <Clock className="w-5 h-5" />
                          ) : isRejected ? (
                            <AlertCircle className="w-5 h-5" />
                          ) : isDeposit ? (
                            <ArrowDownRight className="w-5 h-5" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground">{displayLabel}</div>
                          <div className="text-muted text-xs">{tx.date}</div>
                        </div>
                      </div>
                      <div className={`font-semibold text-right shrink-0 leading-snug ${textColor}`}>
                        <div className="whitespace-nowrap">
                          {prefix}{truncate5(tx.change).toLocaleString(undefined, { maximumFractionDigits: 5 })}
                        </div>
                        <div className="whitespace-nowrap font-normal text-muted text-sm">
                          {details.symbol}
                        </div>
                      </div>
                    </div>
                    {/* Show rejection message inline */}
                    {isRejected && tx.message && (
                      <div className="ml-13 pl-[52px] text-xs text-muted leading-relaxed">
                        <span className="text-destructive/70 font-medium">Reason: </span>{tx.message}
                      </div>
                    )}
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
