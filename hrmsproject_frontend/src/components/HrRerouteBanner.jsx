// Info banner shown to a Reporting Manager on a record they are handling for a disabled HR.
// Style per spec (Part 3): bg #E6F1FB (blue-50), text #0C447C 12px, 0.5px #B5D4F4 border,
// radius 6, padding 6px 12px, ℹ info icon.
//
// variant="row"    → compact text for a list row (below the employee name).
// variant="detail" → longer note for a detail/modal view; pass employeeName for personalisation.
export default function HrRerouteBanner({ variant = "row", employeeName = "", className = "" }) {
  const text =
    variant === "detail"
      ? `Note: ${employeeName ? `${employeeName}'s` : "This employee's"} assigned HR account has been disabled. You are receiving this for HR-level approval as their Reporting Manager.`
      : "The assigned HR for this employee is currently disabled. As their Reporting Manager, you are handling the HR approval as well.";

  return (
    <div
      className={`inline-flex items-start gap-1.5 ${className}`}
      style={{
        backgroundColor: "#E6F1FB",
        color: "#0C447C",
        fontSize: "12px",
        border: "0.5px solid #B5D4F4",
        borderRadius: "6px",
        padding: "6px 12px",
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true" style={{ lineHeight: 1.4 }}>ℹ</span>
      <span>{text}</span>
    </div>
  );
}
