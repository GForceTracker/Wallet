// Shared types used across views.
// Data is now persisted in the cloud database via the Python API (src/api.ts).

export type AssetType = "btc" | "eth" | "usdt_trc20" | "usdt_bep20" | "usdt_erc20" | "trx";

export interface Balances {
  btc: number;
  eth: number;
  usdt_trc20: number;
  usdt_bep20: number;
  usdt_erc20: number;
  trx: number;
}

export interface Transaction {
  id?: number;
  asset: AssetType;
  type: string;
  change: number;
  date: string;
}
