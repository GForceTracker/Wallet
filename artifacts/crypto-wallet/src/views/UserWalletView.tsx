import React, { useEffect, useState, useRef } from 'react';
import { Settings, Search, ArrowUpRight, ArrowDownRight, LogOut, Copy, X, Bell, CheckCircle, XCircle } from 'lucide-react';
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

function NotificationModal({ notification, onDismiss }: { notification: NotificationData; onDismiss: () => void }) {
  const type = notification.notif_type ?? 'deposit';
  const isConfirmed = type === 'withdrawal_confirmed';
  const isRejected = type === 'withdrawal_rejected';

  const iconBg = isConfirmed
    ? 'bg-success/15'
    : isRejected
    ? 'bg-destructive/15'
    : 'bg-success/15';

  const iconColor = isConfirmed
    ? 'text-success'
    : isRejected
    ? 'text-destructive'
    : 'text-success';

  const title = isConfirmed
    ? 'Withdrawal Confirmed!'
    : isRejected
    ? 'Withdrawal Rejected'
    : 'Deposit Received!';

  const btnClass = isRejected
    ? 'bg-destructive hover:bg-destructive/90 text-white'
    : 'bg-success hover:bg-success/90 text-white';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5">
      <div className="w-full max-w-[380px] bg-card border border-border rounded-3xl p-7 flex flex-col items-center gap-5 shadow-2xl">
        <div className={`w-16 h-16 rounded-full ${iconBg} flex items-center justify-center`}>
          {isRejected
            ? <XCircle className={`w-8 h-8 ${iconColor}`} />
            : <CheckCircle className={`w-8 h-8 ${iconColor}`} />
          }
        </div>
        <div className="text-center flex flex-col gap-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-muted text-sm leading-relaxed">{notification.message}</p>
        </div>
        <button
          onClick={onDismiss}
          className={`w-full font-semibold rounded-xl px-4 py-4 transition-colors active:scale-[0.98] ${btnClass}`}
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

  const walletName = wallet?.wallet_name || (username ? `${username}'s Wallet` : 'My Wallet');

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
            // Refresh wallet balance so it's already updated behind the popup
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
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <button
            onClick={() => onNavigate('settings')}
            className="p-2 -ml-2 text-muted hover:text-foreground transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <TrantLogo size={18} />
            <span className="font-bold tracking-[0.12em] text-foreground text-sm">TRANT</span>
          </div>
          <button className="p-2 -mr-2 text-muted hover:text-foreground transition-colors">
            <Search className="w-5 h-5" />
          </button>
        </div>

        {/* Wallet name */}
        <div className="text-center pt-1 pb-0.5">
          <span className="text-[11px] text-muted tracking-wider uppercase font-medium">{walletName}</span>
        </div>

        {/* Balance */}
        <div className="flex flex-col items-center justify-center py-4">
          <span className="text-muted text-xs mb-1">Total Balance</span>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            {formatFiat(totalBalance)}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-start justify-center gap-7 py-3 mb-1">
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => onNavigate('send-withdraw', 'usdt_trc20')}
              className="w-12 h-12 bg-primary text-background rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors shadow-[0_0_16px_rgba(88,166,255,0.3)] active:scale-95"
            >
              <ArrowUpRight className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <span className="text-[11px] text-foreground font-medium">Send</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => setShowReceive(true)}
              className="w-12 h-12 bg-card border border-border text-primary rounded-full flex items-center justify-center hover:bg-card/80 transition-colors active:scale-95"
            >
              <ArrowDownRight className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <span className="text-[11px] text-foreground font-medium">Receive</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => toast('Fiat payment gateway currently undergoing maintenance.')}
              className="w-12 h-12 bg-card border border-border text-primary rounded-full flex items-center justify-center hover:bg-card/80 transition-colors active:scale-95"
            >
              <span className="text-lg">💳</span>
            </button>
            <span className="text-[11px] text-foreground font-medium">Buy</span>
          </div>
        </div>

        {/* Assets List */}
        <div className="flex-1 px-3 flex flex-col gap-3 overflow-y-auto pb-2">
          <AssetRow
            name="Bitcoin" symbol="BTC" balance={wallet.btc} price={settings.btc_price}
            icon={<div className="bg-[#f7931a]/10 p-2 rounded-full"><SiBitcoin className="text-[#f7931a] w-5 h-5" /></div>}
            onClick={() => onNavigate('asset-details', 'btc')}
          />
          <AssetRow
            name="Ethereum" symbol="ETH" balance={wallet.eth} price={settings.eth_price}
            icon={<div className="bg-[#627eea]/10 p-2 rounded-full"><SiEthereum className="text-[#627eea] w-5 h-5" /></div>}
            onClick={() => onNavigate('asset-details', 'eth')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="TRC20" balance={wallet.usdt_trc20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2 rounded-full"><SiTether className="text-[#26a17b] w-5 h-5" /></div>}
            networkColor={USDT_NETWORK_COLOR.TRC20}
            onClick={() => onNavigate('asset-details', 'usdt_trc20')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="BEP20" balance={wallet.usdt_bep20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2 rounded-full"><SiTether className="text-[#26a17b] w-5 h-5" /></div>}
            networkColor={USDT_NETWORK_COLOR.BEP20}
            onClick={() => onNavigate('asset-details', 'usdt_bep20')}
          />
          <AssetRow
            name="Tether" symbol="USDT" network="ERC20" balance={wallet.usdt_erc20} price={usdtPrice}
            icon={<div className="bg-[#26a17b]/10 p-2 rounded-full"><SiTether className="text-[#26a17b] w-5 h-5" /></div>}
            networkColor={USDT_NETWORK_COLOR.ERC20}
            onClick={() => onNavigate('asset-details', 'usdt_erc20')}
          />
          <AssetRow
            name="Tron" symbol="TRX" balance={wallet.trx} price={settings.trx_price}
            icon={<div className="bg-[#ef0027]/10 p-2 rounded-full"><TrxIcon size={20} /></div>}
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
        <NotificationModal notification={pendingNotif} onDismiss={handleDismissNotif} />
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
      className="flex items-center justify-between px-3 py-3.5 bg-card border border-border rounded-xl hover:border-border/80 transition-colors active:scale-[0.98] w-full text-left"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="font-medium text-foreground text-sm flex items-center gap-1.5">
            {name}
            {network && (
              <span
                className="text-[9px] font-bold px-1 py-0.5 rounded text-white leading-tight"
                style={{ backgroundColor: networkColor }}
              >
                {network}
              </span>
            )}
          </div>
          <div className="text-muted text-xs">${price.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-medium text-foreground text-sm">
          {balance > 0 ? balance.toLocaleString(undefined, { maximumFractionDigits: 8 }) : '0'} {symbol}
        </div>
        <div className="text-muted text-xs">
          ${fiatVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      </div>
    </button>
  );
}
