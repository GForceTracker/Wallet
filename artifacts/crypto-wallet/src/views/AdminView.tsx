import React, { useEffect, useState } from 'react';
import { LogOut, Save } from 'lucide-react';
import { getBalances, saveBalances, getHistory, saveHistory, Balances, Transaction } from '../store';
import { toast } from 'sonner';

interface AdminViewProps {
  onLogout: () => void;
}

export function AdminView({ onLogout }: AdminViewProps) {
  const [balances, setBalances] = useState<Balances | null>(null);
  const [inputBalances, setInputBalances] = useState<{btc: string, eth: string, usdt: string}>({ btc: '', eth: '', usdt: '' });

  useEffect(() => {
    const current = getBalances();
    setBalances(current);
    setInputBalances({
      btc: current.btc.toString(),
      eth: current.eth.toString(),
      usdt: current.usdt.toString()
    });
  }, []);

  const handleSave = () => {
    if (!balances) return;

    const newBtc = parseFloat(inputBalances.btc) || 0;
    const newEth = parseFloat(inputBalances.eth) || 0;
    const newUsdt = parseFloat(inputBalances.usdt) || 0;

    const btcDiff = newBtc - balances.btc;
    const ethDiff = newEth - balances.eth;
    const usdtDiff = newUsdt - balances.usdt;

    const newBalances = { btc: newBtc, eth: newEth, usdt: newUsdt };
    saveBalances(newBalances);

    // Save history
    const history = getHistory();
    const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const addHistory = (asset: 'btc'|'eth'|'usdt', diff: number) => {
      if (Math.abs(diff) > 0.00000001) {
        history.push({
          asset,
          type: diff > 0 ? 'Admin Deposit' : 'Admin Charge',
          change: Math.abs(diff),
          date: today
        });
      }
    };

    addHistory('btc', btcDiff);
    addHistory('eth', ethDiff);
    addHistory('usdt', usdtDiff);

    saveHistory(history);
    setBalances(newBalances);

    toast.success('Balances updated successfully');
  };

  if (!balances) return null;

  return (
    <div className="flex flex-col h-full bg-background pb-6">
      <div className="flex flex-col p-6 pt-10">
        <h1 className="text-2xl font-semibold text-foreground mb-1">Admin Panel</h1>
        <p className="text-muted text-sm">Customize user wallet balances below</p>
      </div>

      <div className="flex-1 px-6 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground font-medium flex items-center justify-between">
            <span>Bitcoin (BTC)</span>
            <span className="text-muted text-xs">Current: {balances.btc}</span>
          </label>
          <input
            type="number"
            value={inputBalances.btc}
            onChange={(e) => setInputBalances(prev => ({...prev, btc: e.target.value}))}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            step="any"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground font-medium flex items-center justify-between">
            <span>Ethereum (ETH)</span>
            <span className="text-muted text-xs">Current: {balances.eth}</span>
          </label>
          <input
            type="number"
            value={inputBalances.eth}
            onChange={(e) => setInputBalances(prev => ({...prev, eth: e.target.value}))}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            step="any"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-foreground font-medium flex items-center justify-between">
            <span>Tether (USDT)</span>
            <span className="text-muted text-xs">Current: {balances.usdt}</span>
          </label>
          <input
            type="number"
            value={inputBalances.usdt}
            onChange={(e) => setInputBalances(prev => ({...prev, usdt: e.target.value}))}
            className="w-full bg-card border border-border rounded-xl px-4 py-3.5 text-foreground focus:outline-none focus:border-primary transition-colors"
            step="any"
          />
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-primary hover:bg-primary/90 text-background font-medium rounded-xl px-4 py-4 mt-4 transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Save className="w-5 h-5" />
          Save Changes
        </button>
      </div>

      <div className="px-6 pt-4 mt-auto">
        <button 
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3.5 text-destructive border border-destructive/20 hover:bg-destructive/10 transition-colors rounded-xl active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout Admin</span>
        </button>
      </div>
    </div>
  );
}
