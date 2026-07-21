// Helpers for appending an employee's current client project after their name.
// Format: "Name · Project". When there is no assigned project, nothing is appended
// (never "· null" / "· undefined").

/** Plain-string suffix, e.g. " · Website Revamp" — for <option> labels and titles. */
export function projectSuffix(project) {
    const p = (project || "").trim();
    return p ? ` · ${p}` : "";
}

/** Plain-string "Name · Project" (project omitted when absent). */
export function nameWithProject(name, project) {
    return `${name || ""}${projectSuffix(project)}`;
}

/**
 * Styled inline suffix: renders " · Project" in a lighter, slightly smaller style than
 * the name (13px / 400 / secondary). Renders nothing when no project is assigned.
 */
export function ProjectSuffix({ project }) {
    const p = (project || "").trim();
    if (!p) return null;
    return (
        <span className="text-[13px] font-normal text-brand-text/40"> · {p}</span>
    );
}

export default ProjectSuffix;
