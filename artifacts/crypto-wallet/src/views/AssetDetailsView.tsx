import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { ViewState } from '../App';
import { AssetType, getBalances, getHistory, Balances, Transaction, PRICES } from '../store';
import { SiBitcoin, SiEthereum, SiTether } from 'react-icons/si';
import { toast } from 'sonner';

interface AssetDetailsViewProps {
  asset: AssetType;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
}

export function AssetDetailsView({ asset, onNavigate }: AssetDetailsViewProps) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [history, setHistory] = useState<Transaction[]>([]);

  useEffect(() => {
    setBalances(getBalances());
    setHistory(getHistory().filter(h => h.asset === asset));
  }, [asset]);

  if (!balances) return null;

  const balance = balances[asset];
  const price = PRICES[asset];
  const fiatVal = balance * price;

  const getAssetDetails = () => {
    switch(asset) {
      case 'btc': return { name: 'Bitcoin', symbol: 'BTC', icon: <div className="bg-[#f7931a]/20 p-4 rounded-full"><SiBitcoin className="text-[#f7931a] w-10 h-10" /></div> };
      case 'eth': return { name: 'Ethereum', symbol: 'ETH', icon: <div className="bg-[#627eea]/20 p-4 rounded-full"><SiEthereum className="text-[#627eea] w-10 h-10" /></div> };
      case 'usdt': return { name: 'Tether', symbol: 'USDT', icon: <div className="bg-[#26a17b]/20 p-4 rounded-full"><SiTether className="text-[#26a17b] w-10 h-10" /></div> };
    }
  };

  const details = getAssetDetails();

  const handleReceive = () => {
    toast('Your receiving address is linked directly to your account keys.');
  };

  return (
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
          onClick={handleReceive}
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
            {history.slice().reverse().map((tx, idx) => {
              const isDeposit = tx.type.toLowerCase().includes('deposit');
              return (
                <div key={idx} className="flex items-center justify-between pb-4 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDeposit ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {isDeposit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{tx.type}</div>
                      <div className="text-muted text-xs">{tx.date}</div>
                    </div>
                  </div>
                  <div className={`font-semibold ${isDeposit ? 'text-success' : 'text-foreground'}`}>
                    {isDeposit ? '+' : '-'}{tx.change.toLocaleString(undefined, { maximumFractionDigits: 8 })} {details.symbol}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
