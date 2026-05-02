/**
 * Priority watchlist for Naphtha vs VOO alpha overlay（ユーザ指定をコードで固定）。
 * `resolveNaphthaWatchRows` がエコシステムに存在するティッカーのみ採用。
 */
export type NaphthaWatchPriorityEntry = {
  ticker: string;
  shortLabelJa: string;
};

export const NAPHTHA_WATCH_PRIORITY: NaphthaWatchPriorityEntry[] = [
  { ticker: "4063.T", shortLabelJa: "信越化学" },
  { ticker: "4118.T", shortLabelJa: "カネカ" },
  { ticker: "3863.T", shortLabelJa: "日本製紙" },
];

/** Yahoo シンボル: シンガポールナフサ先物に相当する流動性のある代替（環境変数で上書き） */
export const NAPHTHA_DEFAULT_YAHOO_PROXY = "CL=F";
