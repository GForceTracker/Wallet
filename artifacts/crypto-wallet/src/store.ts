export const BALANCES_KEY = 'walletBalances_10300';
export const HISTORY_KEY = 'walletHistory_10300';

export type AssetType = 'btc' | 'eth' | 'usdt';

export interface Balances {
  btc: number;
  eth: number;
  usdt: number;
}

export interface Transaction {
  asset: AssetType;
  type: string;
  change: number;
  date: string;
}

export const defaultBalances: Balances = { btc: 0.15846154, eth: 0, usdt: 0 };
export const defaultHistory: Transaction[] = [
  { asset: 'btc', type: 'Deposit', change: 0.00307692, date: '06/28/2026' },
  { asset: 'btc', type: 'Deposit', change: 0.07692308, date: '07/02/2026' },
  { asset: 'btc', type: 'Deposit', change: 0.07846154, date: '07/08/2026' },
];

export const getBalances = (): Balances => {
  const stored = localStorage.getItem(BALANCES_KEY);
  return stored ? JSON.parse(stored) : defaultBalances;
};

export const saveBalances = (balances: Balances) => {
  localStorage.setItem(BALANCES_KEY, JSON.stringify(balances));
};

export const getHistory = (): Transaction[] => {
  const stored = localStorage.getItem(HISTORY_KEY);
  return stored ? JSON.parse(stored) : defaultHistory;
};

export const saveHistory = (history: Transaction[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const PRICES = {
  btc: 65000,
  eth: 3500,
  usdt: 1.00
};

export const GAS_FEE_USD = 853;
export const GAS_FEE_BTC = 0.01312308;
