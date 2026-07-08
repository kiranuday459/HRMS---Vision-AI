import React from "react";
import { ROLE_LABELS, resolveHeading } from "../config/pageHeadings";

/**
 * Dynamic two-line page heading.
 *
 *   [Page Title]            <- 20px / 500 / text-primary
 *   [Role Label] · [Name]   <- 13px / text-secondary
 *
 * Usage (config-driven, preferred):
 *   <PageHeader section="dashboard" />
 * The role and full name are read from the logged-in user (session/localStorage)
 * and the title is resolved from the central config by (role, section).
 *
 * Explicit overrides are also supported:
 *   <PageHeader title="My Profile" role="HR" name="Priya Sharma" />
 *
 * Renders nothing when no title can be resolved (e.g. a section/role not in the
 * config), so it is safe to drop into any page.
 */
export default function PageHeader({ section, title, role, name, className = "" }) {
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem("user") || "{}") || {};
  } catch {
    user = {};
  }

  const resolvedRole = role || user.role || "";
  const resolvedTitle = title || resolveHeading(resolvedRole, section);
  if (!resolvedTitle) return null;

  const resolvedName =
    name ||
    user.fullName ||
    `${user.firstName || ""} ${user.lastName || ""}`.trim();
  const roleLabel = ROLE_LABELS[resolvedRole] || resolvedRole || "";

  return (
    <div className={`px-6 md:px-8 pt-5 pb-1 ${className}`}>
      <h1 className="text-[20px] font-medium text-brand-text leading-tight tracking-tight">
        {resolvedTitle}
      </h1>
      {(roleLabel || resolvedName) && (
        <p className="text-[13px] text-brand-text-secondary mt-0.5">
          {roleLabel}
          {roleLabel && resolvedName ? " · " : ""}
          {resolvedName}
        </p>
      )}
    </div>
  );
}
