// Consistent DISABLED badge shown beside a disabled employee's name/card/row.
// Style is fixed by spec: bg #D3D1C7, text #5F5E5A, 10px / 500, radius 4, padding 2/8.
export default function DisabledBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px] leading-none ${className}`}
    >
      DISABLED
    </span>
  );
}
