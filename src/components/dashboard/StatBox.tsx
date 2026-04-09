import React from "react";

export function StatBox({
  label,
  value,
  subLabel,
  valueColor = "text-white",
  title,
}: {
  label: string;
  value: string;
  subLabel?: string;
  valueColor?: string;
  /** ホバーで基準時刻などを表示 */
  title?: string;
}) {
  return (
    <div title={title}>
      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-wider">
        {label}
      </span>
      <span className={`text-3xl font-bold font-mono ${valueColor}`}>{value}</span>
      {subLabel && (
        <p className="text-[9px] mt-1 uppercase font-bold text-slate-400 tracking-tighter">
          {subLabel}
        </p>
      )}
    </div>
  );
}

