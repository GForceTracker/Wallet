import React, { useEffect, useState, useRef } from 'react';
import { Settings, Search, ArrowUpRight, ArrowDownRight, LogOut, Copy, X, Bell } from 'lucide-react';
import { SiBitcoin, SiEthereum, SiTether } from 'react-icons/si';
import { TrantLogo } from '../components/TrantLogo';
import { ViewState } from '../App';
import { AssetType } from '../store';
import { api, WalletData, SettingsData, NotificationData } from '../api';
import { toast } from 'sonner';

const TrxIcon = ({ size = 24 }: { size?: number }) => (
  <img
    src="https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa/svg/color/trx.svg"
    width={size}
    height={size}
    alt="TRX"
  />
);

type UsdtNetwork = 'TRC20' | 'BEP20' | 'ERC20';
const USDT_NETWORK_COLOR: Record<UsdtNetwork, string> = {
  TRC20: '#ef0027',
  BEP20: '#F0B90B',
  ERC20: '#627eea',
};

interface UserWalletViewProps {
  username: string;
  onNavigate: (view: ViewState, asset?: AssetType) => void;
  onLogout: () => void;
}

interface ReceiveModalProps {
  settings: SettingsData;
  onClose: () => void;
}

function ReceiveModal({ settings, onClose }: ReceiveModalProps) {
  const [tab, setTab] = useState<AssetType>('btc');
  const addressMap: Record<AssetType, string | null | undefined> = {
    btc: settings.deposit_address_btc,
    eth: settings.deposit_address_eth,
    usdt_trc20: settings.deposit_address_usdt_trc20,
    usdt_bep20: settings.deposit_address_usdt_bep20,
    usdt_erc20: settings.deposit_address_usdt_erc20,
    trx: settings.deposit_address_trx,
  };
  const tabLabels: Record<AssetType, string> = {
    btc: 'BTC', eth: 'ETH', usdt_trc20: 'TRC20', usdt_bep20: 'BEP20', usdt_erc20: 'ERC20', trx: 'TRX',
  };
  const address = addressMap[tab];
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
          <h2 className="text-lg font-semibold text-foreground">Receive Crypto</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(['btc', 'eth', 'trx', 'usdt_trc20', 'usdt_bep20', 'usdt_erc20'] as AssetType[]).map((a) => (
            <button
              key={a}
              onClick={() => setTab(a)}
              className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                tab === a ? 'bg-primary text-background' : 'bg-background border border-border text-muted hover:text-foreground'
              }`}
            >
              {tabLabels[a]}
            </button>
          ))}
        </div>
        {address ? (
          <>
            <p className="text-sm text-muted">Send only {tabLabels[tab]} to this address.</p>
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
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-muted text-sm">No {tabLabels[tab]} deposit address configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DepositNotificationModal({ notification, onDismiss }: { notification: NotificationData; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-[380px] bg-card border border-border rounded-3xl p-7 flex flex-col items-center gap-5 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center">
          <ArrowDownRight className="w-8 h-8 text-success" />
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-foreground">Deposit Received!</h2>
          <p className="text-muted text-sm leading-relaxed">{notification.message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-full bg-success hover:bg-success/90 text-white font-semibold rounded-xl px-4 py-4 transition-colors active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

export function UserWalletView({ username, onNavigate, onLogout }: UserWalletViewProps) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);
  const [pendingNotif, setPendingNotif] = useState<NotificationData | null>(null);
  const seenIdsRef = useRef<Set<number>>(new Set());

  const walletName = username ? `${username} Wallet 1` : 'My Wallet';

  useEffect(() => {
    Promise.all([api.getWallet(), api.getSettings()])
      .then(([w, s]) => { setWallet(w); setSettings(s); })
      .catch(() => toast.error('Failed to load wallet data'))
      .finally(() => setLoading(false));
  }, []);

  // Refresh prices every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      api.getSettings().then(s => setSettings(s)).catch(() => {});
      api.getWallet().then(w => setWallet(w)).catch(() => {});
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  // Poll notifications every 15 seconds
  useEffect(() => {
    const checkNotifs = () => {
      api.getNotifications()
        .then(notifs => {
          const unseen = notifs.find(n => !seenIdsRef.current.has(n.id));
          if (unseen && !pendingNotif) {
            seenIdsRef.current.add(unseen.id);
            // Refresh wallet balance immediately so it's already updated behind the popup
            api.getWallet().then(w => setWallet(w)).catch(() => {});
            setPendingNotif(unseen);
          }
        })
        .catch(() => {});
    };
    checkNotifs();
    const interval = setInterval(checkNotifs, 15_000);
    return () => clearInterval(interval);
  }, [pendingNotif]);

  const handleDismissNotif = async () => {
    if (!pendingNotif) return;
    await api.markNotificationRead(pendingNotif.id).catch(() => {});
    setPendingNotif(null);
  };

  if (loading || !wallet || !settings) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usdtPrice = settings.usdt_price;
  const totalBalance =
    wallet.btc * settings.btc_price +
    wallet.eth * settings.eth_price +
    wallet.usdt_trc20 * usdtPrice +
    wallet.usdt_bep20 * usdtPrice +
    wallet.usdt_erc20 * usdtPrice +
    wallet.trx * settings.trx_price;

  const formatFiat = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  return (
    <>
      <div className="flex flex-col h-full bg-background pb-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-7 pb-2">
          <button
            onClick={() => onNavigate('settings')}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors"
          >
            <Settings className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1.5">
            <TrantLogo size={20} />
            <span className="font-bold tracking-[0.12em] text-foreground text-base">TRANT</span>
          </div>
          <button className="p-2 -mr-2 text-muted hover:text-foreground transition-colors">
            <Search className="w-6 h-6" />
          </button>
        </div>

        {/* Wallet name */}
        <div className="text-center pt-1 pb-1">
          <span className="text-xs text-muted tracking-wider uppercase font-medium">{walletName}</span>
        </div>

        {/* Balance */}
        <div className="flex flex-col items-center justify-center py-5">
          <span className="text-muted text-sm mb-1.5">Total Balance</span>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground">
            {formatFiat(totalBalance)}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-start justify-center gap-8 py-4 mb-2">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => onNavigate('send-withdraw', 'usdt_trc20')}
              className="w-14 h-14 bg-primary text-background rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(88,166,255,0.3)] active:scale-95"
            >
              <ArrowUpRight className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <span className="text-xs text-foreground font-medium">Send</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setShowReceive(true)}
              className="w-14 h-14 bg-card border border-border text-primary rounded-full flex items-center justify-center hover:bg-card/80 transition-colors active:scale-95"
            >
              <ArrowDownRight className="w-6 h-6" strokeWidth={2.5} />
            </button>
            <span className="text-xs text-foreground font-medium">Receive</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => toast('Fiat payment gateway currently undergoing maintenance.')}
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
            name="Bitcoin" symbol="BTC" balance={wallet.btc} price={settings.btc_price}
            icon={<div className="bg-[#f7931a]/10 p-2.5 rounded-full"><SiBitcoin className="text-[#f7931a] w-6 h-6" /></div>}
            onClick={() => onNavigate('asset-details', 'btc')}
          />
          <AssetRow
            name="Ethereum" symbol="ETH" balance={wallet.eth} price={settings.eth_price}
            icon={<div className="bg-[#627eea]/10 p-2.5 rounded-full"><SiEthereum className="text-[#627eea] w-6 h-6" /></div>}
            onClick={() => onNavigate('asset-details', 'eth')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="TRC20" balance={wallet.usdt_trc20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2.5 rounded-full"><SiTether className="text-[#26a17b] w-6 h-6" /></div>}
            networkColor={USDT_NETWORK_COLOR.TRC20}
            onClick={() => onNavigate('asset-details', 'usdt_trc20')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="BEP20" balance={wallet.usdt_bep20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2.5 rounded-full"><SiTether className="text-[#26a17b] w-6 h-6" /></div>}
            networkColor={USDT_NETWORK_COLOR.BEP20}
            onClick={() => onNavigate('asset-details', 'usdt_bep20')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="ERC20" balance={wallet.usdt_erc20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2.5 rounded-full"><SiTether className="text-[#26a17b] w-6 h-6" /></div>}
            networkColor={USDT_NETWORK_COLOR.ERC20}
            onClick={() => onNavigate('asset-details', 'usdt_erc20')}
          />
          <AssetRow
            name="Tron" symbol="TRX" balance={wallet.trx} price={settings.trx_price}
            icon={<div className="bg-[#ef0027]/10 p-2.5 rounded-full"><TrxIcon size={24} /></div>}
            onClick={() => onNavigate('asset-details', 'trx')}
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

      {showReceive && settings && (
        <ReceiveModal settings={settings} onClose={() => setShowReceive(false)} />
      )}

      {pendingNotif && (
        <DepositNotificationModal notification={pendingNotif} onDismiss={handleDismissNotif} />
      )}
    </>
  );
}

function AssetRow({ name, symbol, network, networkColor, balance, price, icon, onClick }: {
  name: string; symbol: string; network?: string; networkColor?: string;
  balance: number; price: number; icon: React.ReactNode; onClick: () => void;
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
          <div className="font-semibold text-foreground text-base flex items-center gap-2">
            {name}
            {network && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white leading-tight"
                style={{ backgroundColor: networkColor }}
              >
                {network}
              </span>
            )}
          </div>
          <div className="text-muted text-sm">${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
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
