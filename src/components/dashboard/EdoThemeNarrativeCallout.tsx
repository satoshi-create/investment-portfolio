import React from "react";

/**
 * 江戸循環テーマ専用: Investment thesis 直下に出す補足（DB の description とは重複を避けつつ文脈を補う）。
 */
export function EdoThemeNarrativeCallout() {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-200/85">
        Edo-circular レンズ
      </p>
      <p className="text-sm text-foreground/90 leading-relaxed">
        下町の「廻し」や大目付の分業に似た、エネルギー・素材・命の三層ネット。直列の消費だけでなく、国内に閉じる再資源化の回路（還流）に報いる銘柄を、VOO/地域ベンチに対する Alpha と決算の節目で切る。
      </p>
      <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 space-y-1">
        <li>エネルギー還流: 水素・バイオ燃料・廃棄物起点の熱と原料の回帰</li>
        <li>素材還流: 紙・梱包・粉体の閉塞ループと、炭素の「森番」としての固定化</li>
        <li>生命還流: 生薬・再製造医療・未病で身体側の代謝に寄り添う層</li>
      </ul>
    </div>
  );
}
