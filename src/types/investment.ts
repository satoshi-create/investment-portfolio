export type AlphaHistory = number[];

export interface Stock {
  id: number;
  ticker: string;
  name: string;
  tag: string;
  alphaHistory: AlphaHistory;
  weight: number;
  quantity: number;
}

export interface Signal extends Stock {
  isWarning: boolean;
  isBuy: boolean;
  currentAlpha: number;
}

export interface SignalPerformanceLog {
  date: string;
  ticker: string;
  type: "BUY" | "WARN";
  result: string;
  status: "Active" | "Avoided" | "Success" | "Failed";
}
