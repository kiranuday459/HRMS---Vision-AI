import React from "react";

/**
 * Reusable dashboard metric card.
 *
 *   <MetricCard label="Present Today" value={98} delta="4 absent" deltaType="down" />
 *
 * Props:
 *  - label     : small caption above the number
 *  - value     : the main figure (number or string)
 *  - delta     : optional sub-line below the value (e.g. "4 absent")
 *  - deltaType : "up" (green ↑) | "down" (red ↓) | "neutral" (grey, no arrow)
 *  - loading   : when true, renders a skeleton placeholder
 *
 * Style follows the design reference: background-secondary, no border,
 * 8px radius, 12px secondary label, 22px/500 primary value.
 */
export default function MetricCard({ label, value, delta, deltaType, loading = false }) {
  if (loading) {
    return (
      <div className="bg-bg-slate rounded-lg p-5 animate-pulse">
        <div className="h-3 w-24 bg-brand-blue/10 rounded mb-3" />
        <div className="h-6 w-16 bg-brand-blue/15 rounded mb-2" />
        <div className="h-3 w-20 bg-brand-blue/10 rounded" />
      </div>
    );
  }

  const arrow = deltaType === "up" ? "↑" : deltaType === "down" ? "↓" : "";
  const deltaColor =
    deltaType === "up"
      ? "text-emerald-600"
      : deltaType === "down"
      ? "text-red-500"
      : "text-brand-text-secondary";

  return (
    <div className="bg-bg-slate rounded-lg p-5">
      <p className="text-[12px] text-brand-text-secondary font-medium leading-none">{label}</p>
      <p className="text-[22px] font-medium text-brand-text leading-tight mt-2">
        {value ?? 0}
      </p>
      {delta && (
        <p className={`text-[12px] font-medium mt-1.5 ${deltaColor}`}>
          {arrow && <span className="mr-1">{arrow}</span>}
          {delta}
        </p>
      )}
    </div>
  );
}
