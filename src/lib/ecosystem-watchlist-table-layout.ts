/**
 * 観測 Ecosystem 表の Asset（field）列幅。
 * 列数が減っても field 帯行の第 2 セルがテーブル全幅を占有して Asset が横に伸びないよう、
 * thead / tbody の asset セルと field 見出し行の左バケットで共有する（`table-fixed` と併用想定）。
 */
export const ECOSYSTEM_ASSET_COL_WIDTH_CLASS = "min-w-[10rem] w-[12rem] max-w-[12rem]";
