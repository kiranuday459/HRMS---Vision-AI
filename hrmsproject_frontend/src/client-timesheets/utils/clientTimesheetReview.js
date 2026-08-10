import api from "../../utils/api";

/**
 * Approving and rejecting a client-timesheet week.
 *
 * A week is not one record. It is stored as one client_timesheets row per day per project row,
 * and the admin queue derives the week's badge from all of them at once (AdminPage's
 * resolveWeekStatus: any PENDING line keeps the whole week PENDING). A review action therefore
 * has to cover every id in the block.
 *
 * This exists because the two places that review a week had drifted: the row-level buttons
 * looped over the block's ids, while the detail drawer posted to the single day id the eye icon
 * happened to be opened with. Approving from the drawer flipped one line of seven, the other six
 * stayed PENDING, and the queue never moved — the week still read "Pending" no matter how many
 * times it was approved. Both callers now share these two functions so they cannot diverge again.
 */

/**
 * Posts the same action for every line in the week and fails loudly if any of them did not take.
 *
 * The ok-check matters: `fetch` resolves for a 4xx just as happily as for a 200, so awaiting the
 * calls alone proves only that the server answered — not that it agreed. Without this, a
 * half-applied week reports "Week approved" and leaves the queue looking broken.
 */
const postForEachLine = async (ids, action, body) => {
    const list = (ids || []).filter((id) => id != null);
    if (list.length === 0) {
        throw new Error("No timesheet entries to update.");
    }
    const responses = await Promise.all(
        list.map((id) => api(`/api/client-timesheets/${id}/${action}`, {
            method: "POST",
            body: JSON.stringify(body),
        }))
    );
    const failed = responses.filter((r) => !r || !r.ok);
    if (failed.length > 0) {
        throw new Error(`${failed.length} of ${responses.length} entries could not be updated.`);
    }
};

/** Approve every day row in the week. */
export const approveWeek = (timesheetIds, reviewerId) =>
    postForEachLine(timesheetIds, "approve", { reviewerId });

/** Reject every day row in the week, writing the same reason onto each. */
export const rejectWeek = (timesheetIds, reviewerId, reason) =>
    postForEachLine(timesheetIds, "reject", { reviewerId, reason });
