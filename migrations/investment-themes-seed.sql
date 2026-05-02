-- Seed structural themes for Notion migration (edit copy to taste).
-- Requires profiles row (e.g. user-satoshi) and migration 010_investment_themes.sql.

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO investment_themes (id, user_id, name, description, goal, created_at) VALUES
(
  'theme-seed-ai-datacenter',
  'user-satoshi',
  'AIデータセンター',
  '生成AI・クラウド需要の拡大に伴うデータセンター向け投資仮説。GPU/ネットワーク/電力/冷却など、供給制約と設備投資サイクルが収益に効くサプライチェーンを重視する。',
  'サテライト枠の一部をこのテーマに集中し、中長期の構造成長とボラティリティのバランスを取りながら積み上げる。',
  datetime('now')
),
(
  'theme-seed-de-oil',
  'user-satoshi',
  '非石油文明',
  '脱炭素とエネルギー転換（EV、再エネ、省エネ・分散化）へのシフトを前提とした投資仮説。従来の化石燃料依存度の高いポートフォリオとの相関を下げる。',
  'マイルストーン（実体経済・政策・技術コスト曲線）に合わせて配分を見直し、テーマ内でも銘柄分散を維持する。',
  datetime('now')
),
(
  'theme-seed-edo-circular',
  'user-satoshi',
  '江戸循環ネットワーク文明',
  '大江戸の下町的な「廻し」と分業を、今の言葉にするならエネルギー・素材・生命の三層還流だ。直線的な消費だけに賭けず、地政学ショックで跳ねるエネルギー価格に対し、国内で閉じる再資源化とリサイクル、生体側の代謝に乗るプレイに分散して張るテーマ。',
  '日足 Alpha と Z・落率で層ごとの凹凸を追い、決算と政策・サプライ事件で「還流の要」にどれだけ報いが返るかを見切る。高油価局面ほど、エネルギー還流層の現金化速度を、素材・生命層の耐久とセットで観測する。',
  datetime('now')
),
(
  'theme-seed-semiconductor-equipment',
  'user-satoshi',
  '半導体サプライチェーン',
  '材料・装置・設計（ファブレス）・IDM・後工程まで、半導体バリューチェーン全体を一枚の地図で観測する。CSV の各プレイヤーをエコシステムに載せ、VOO 対 Alpha と決算・地政イベントで分解する。',
  'SOX/NDX とファウンドリ設備投資・メモリ価格を併読し、テーマ加重累積 Alpha と銘柄別 Z・落率で「全体β」と「チェーン内相対」を切り分ける。',
  datetime('now')
),
(
  'theme-seed-oil-civilization',
  'user-satoshi',
  '石油文明',
  '石油・ガスメジャーからシェール、油田サービス、川中物流・代替化石まで、資源価格と地政学を軸にした「旧エネルギーOS」の観測テーマ。',
  '供給ショックと政策・在庫サイクルを併読し、ヘッジとサイクリカルのバッファを切り分ける。',
  datetime('now')
)