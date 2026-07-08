// Full-width banner shown at the top of a disabled employee's profile/detail view.
// Placed below the page heading, above the content. Style per spec: bg #F1EFE8,
// 13px text-secondary, radius 8, padding 12/16.
export default function DisabledBanner({ className = "" }) {
  return (
    <div
      className={`w-full flex items-start gap-2 rounded-lg px-4 py-3 bg-[#F1EFE8] text-[13px] text-[#5F5E5A] ${className}`}
    >
      <span className="leading-none mt-0.5">⚠</span>
      <div>
        This account has been disabled. Viewing for reference only. No actions can be taken.
      </div>
    </div>
  );
}
