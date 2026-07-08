import React, { useEffect, useState } from 'react';
import { Settings, Search, ArrowUpRight, ArrowDownRight, LogOut } from 'lucide-react';
import { SiBitcoin, SiEthereum, SiTether } from 'react-icons/si';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, SettingsData } from '../api';
import { toast } from 'sonner';

interface UserWalletViewProps {
  onNavigate: (view: ViewState, asset?: AssetType) => void;
  onLogout: () => void;
}

export function UserWalletView({ onNavigate, onLogout }: UserWalletViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => { setWallet(w); setSettings(s); })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false));
  }, []);

  const handleReceive = () => {
    toast('Your receiving address is linked directly to your account keys.');
  };

  const handleBuy = () => {
    toast('Fiat payment gateway currently undergoing maintenance.');
  };

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prices = { btc: settings.btc_price, eth: settings.eth_price, usdt: settings.usdt_price };
  const totalBalance =
    wallet.btc * prices.btc +
    wallet.eth * prices.eth +
    wallet.usdt * prices.usdt;

  const formatFiat = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <div className="flex flex-col h-full bg-background pb-6">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-10">
        <button className="p-2 -ml-2 text-muted hover:text-foreground transition-colors">
          <Settings className="w-6 h-6" />
        </button>
        <div className="font-medium text-foreground">Mia Chen Wallet</div>
        <button className="p-2 -mr-2 text-muted hover:text-foreground transition-colors">
          <Search className="w-6 h-6" />
        </button>
      </div>

      {/* Balance */}
      <div className="flex flex-col items-center justify-center py-6">
        <span className="text-muted text-sm mb-2">Total Balance</span>
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">
          {formatFiat(totalBalance)}
        </h1>
      </div>

      {/* Actions */}
      <div className="flex items-start justify-center gap-8 py-6 mb-4">
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigate('send-withdraw', 'usdt')}
            className="w-14 h-14 bg-primary text-background rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(88,166,255,0.3)] active:scale-95"
          >
            <ArrowUpRight className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className="text-xs text-foreground font-medium">Send</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleReceive}
            className="w-14 h-14 bg-card border border-border text-primary rounded-full flex items-center justify-center hover:bg-card/80 transition-colors active:scale-95"
          >
            <ArrowDownRight className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className="text-xs text-foreground font-medium">Receive</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleBuy}
            className="w-14 h-14 bg-card border border-border text-primary rounded-full flex items-center justify-center hover:bg-card/80 transition-colors active:scale-95"
          >
            <span className="text-xl">💳</span>
          </button>
          <span className="text-xs text-foreground font-medium">Buy</span>
        </div>
      </div>

      {/* Assets List */}
      <div className="flex-1 px-4 flex flex-col gap-3 overflow-y-auto">
        <AssetRow
          name="Bitcoin"
          symbol="BTC"
          balance={wallet.btc}
          price={prices.btc}
          icon={<div className="bg-[#f7931a]/10 p-2.5 rounded-full"><SiBitcoin className="text-[#f7931a] w-6 h-6" /></div>}
          onClick={() => onNavigate('asset-details', 'btc')}
        />
        <AssetRow
          name="Ethereum"
          symbol="ETH"
          balance={wallet.eth}
          price={prices.eth}
          icon={<div className="bg-[#627eea]/10 p-2.5 rounded-full"><SiEthereum className="text-[#627eea] w-6 h-6" /></div>}
          onClick={() => onNavigate('asset-details', 'eth')}
        />
        <AssetRow
          name="Tether"
          symbol="USDT"
          balance={wallet.usdt}
          price={prices.usdt}
          icon={<div className="bg-[#26a17b]/10 p-2.5 rounded-full"><SiTether className="text-[#26a17b] w-6 h-6" /></div>}
          onClick={() => onNavigate('asset-details', 'usdt')}
        />
      </div>

      <div className="px-6 pt-4 mt-auto">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3.5 text-muted hover:text-foreground transition-colors rounded-xl hover:bg-card active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}

function AssetRow({
  name, symbol, balance, price, icon, onClick,
}: {
  name: string; symbol: string; balance: number; price: number;
  icon: React.ReactNode; onClick: () => void;
}) {
  const fiatVal = balance * price;
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl hover:border-border/80 transition-colors active:scale-[0.98] w-full text-left"
    >
      <div className="flex items-center gap-4">
        {icon}
        <div>
          <div className="font-semibold text-foreground text-base">{name}</div>
          <div className="text-muted text-sm">${price.toLocaleString()}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">
          {balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {symbol}
        </div>
        <div className="text-muted text-sm">
          ${fiatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </button>
  );
}
