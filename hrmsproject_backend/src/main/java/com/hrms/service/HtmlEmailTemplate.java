package com.hrms.service;

import java.util.List;

/**
 * The shared look of every HRMS notification email: header bar, body, stat block, tables,
 * footer.
 *
 * One shell rather than per-message markup, so the six timesheet emails (client rejection,
 * client Friday reminder, client Monday summary, and the internal module's reminder, pending
 * summary and all-clear) cannot drift into six different designs. Callers supply only the
 * content of their body.
 *
 * Written for email clients, not browsers. That means tables for layout, inline styles on every
 * element, no flexbox/grid, no external stylesheet and no web fonts — Outlook in particular
 * discards a &lt;style&gt; block and much of what a browser would honour. It is verbose on
 * purpose; the alternative is markup that renders correctly only in a preview pane.
 *
 * Pure string building, no dependencies, so the rendering can be exercised directly in a test.
 */
final class HtmlEmailTemplate {

    private HtmlEmailTemplate() {
    }

    // Client Timesheet module branding — dark navy header with a teal accent, over slate
    // neutrals. Mirrors the palette the module's screens already use (#0f172a, #0d9488,
    // #E3E8EF); keep the two in step.
    private static final String NAVY = "#0f172a";
    private static final String TEAL = "#0d9488";
    private static final String TEAL_DARK = "#0f766e";
    private static final String INK = "#1e293b";
    private static final String MUTED = "#64748b";
    private static final String LINE = "#e2e8f0";
    private static final String TINT = "#f8fafc";
    private static final String PAGE = "#eef2f6";

    private static final String FONT =
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

    /**
     * Wraps body content in the standard frame.
     *
     * @param title    the header bar's headline, e.g. "Weekly Client Timesheet Summary"
     * @param subtitle the line under it — normally the week range; omitted when blank
     * @param bodyHtml already-escaped inner markup
     */
    static String page(String title, String subtitle, String bodyHtml) {
        StringBuilder h = new StringBuilder();
        h.append("<div style=\"margin:0;padding:24px 12px;background:").append(PAGE)
                .append(";font-family:").append(FONT).append(";\">");
        h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" ")
                .append("style=\"max-width:640px;margin:0 auto;background:#ffffff;border-radius:10px;")
                .append("overflow:hidden;border:1px solid ").append(LINE).append(";\">");

        // Header bar
        h.append("<tr><td style=\"background:").append(NAVY).append(";padding:22px 28px;")
                .append("border-bottom:4px solid ").append(TEAL).append(";\">");
        h.append("<div style=\"font-size:19px;font-weight:700;color:#ffffff;letter-spacing:.2px;\">")
                .append(esc(title)).append("</div>");
        if (present(subtitle)) {
            h.append("<div style=\"font-size:13px;color:#94a3b8;margin-top:5px;\">")
                    .append(esc(subtitle)).append("</div>");
        }
        h.append("</td></tr>");

        // Body
        h.append("<tr><td style=\"padding:26px 28px 8px 28px;font-size:14px;line-height:1.6;color:")
                .append(INK).append(";\">").append(bodyHtml).append("</td></tr>");

        // Footer
        h.append("<tr><td style=\"padding:18px 28px 24px 28px;border-top:1px solid ").append(LINE)
                .append(";font-size:12px;color:").append(MUTED).append(";\">")
                .append("VisionAI HRMS · automated notification, please do not reply.")
                .append("</td></tr>");

        h.append("</table></div>");
        return h.toString();
    }

    /** "Hi Rahul," — the greeting every message opens with. */
    static String greeting(String name) {
        return "<p style=\"margin:0 0 14px 0;\">Hi " + esc(present(name) ? name.trim() : "there") + ",</p>";
    }

    /** A normal sentence of body copy. */
    static String paragraph(String text) {
        return "<p style=\"margin:0 0 16px 0;\">" + esc(text) + "</p>";
    }

    /** The sign-off. Deliberately one line — these are notifications, not letters. */
    static String closing() {
        return "<p style=\"margin:18px 0 4px 0;color:" + MUTED + ";\">— HRMS Notification System</p>";
    }

    /**
     * The headline figure, boxed and tinted so it reads at a glance instead of sitting inside a
     * sentence. Used for the submitted/pending split on the two admin summaries.
     *
     * @param emphasis  the large figure, e.g. "7 of 10 submitted"
     * @param secondary the trailing detail, e.g. "3 pending" — omitted when blank
     */
    static String statBlock(String emphasis, String secondary) {
        StringBuilder h = new StringBuilder();
        h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" ")
                .append("style=\"margin:0 0 20px 0;background:").append(TINT)
                .append(";border:1px solid ").append(LINE).append(";border-left:4px solid ").append(TEAL)
                .append(";border-radius:6px;\"><tr><td style=\"padding:14px 18px;\">");
        h.append("<span style=\"font-size:17px;font-weight:700;color:").append(NAVY).append(";\">")
                .append(esc(emphasis)).append("</span>");
        if (present(secondary)) {
            h.append("<span style=\"font-size:15px;color:").append(TEAL_DARK)
                    .append(";font-weight:600;\"> &middot; ").append(esc(secondary)).append("</span>");
        }
        h.append("</td></tr></table>");
        return h.toString();
    }

    /** A small uppercase heading above a table or block. */
    static String sectionLabel(String text) {
        return "<div style=\"font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:"
                + MUTED + ";margin:22px 0 8px 0;\">" + esc(text) + "</div>";
    }

    /**
     * Label/value detail rows — the "Employee Name / Employee ID / Project / Week" block the
     * rejection and reminder emails open with. Two columns, labels muted, values in ink.
     */
    static String detailRows(List<String[]> labelValuePairs) {
        StringBuilder h = new StringBuilder();
        h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" ")
                .append("style=\"border-collapse:collapse;margin:0 0 4px 0;\">");
        for (String[] pair : labelValuePairs) {
            h.append("<tr>");
            h.append("<td style=\"padding:7px 12px 7px 0;font-size:13px;color:").append(MUTED)
                    .append(";white-space:nowrap;vertical-align:top;width:34%;\">")
                    .append(esc(pair[0])).append("</td>");
            h.append("<td style=\"padding:7px 0;font-size:14px;color:").append(INK)
                    .append(";font-weight:600;word-break:break-word;\">")
                    .append(esc(blankTo(pair[1]))).append("</td>");
            h.append("</tr>");
        }
        h.append("</table>");
        return h.toString();
    }

    /**
     * A quoted block for free text the recipient must read closely — the admin's rejection
     * reason. Set apart so it is not mistaken for boilerplate.
     */
    static String quote(String text) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" "
                + "style=\"margin:0 0 4px 0;background:" + TINT + ";border:1px solid " + LINE
                + ";border-radius:6px;\"><tr><td style=\"padding:12px 16px;font-size:14px;color:" + INK
                + ";line-height:1.55;word-break:break-word;\">" + esc(blankTo(text)) + "</td></tr></table>";
    }

    /**
     * Highlighted list of days, in amber — the missing/incomplete days an employee must fill.
     * The one thing in these emails that is a call to action rather than a record.
     */
    static String highlight(String label, String value) {
        return "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" "
                + "style=\"margin:0 0 4px 0;background:#fffbeb;border:1px solid #fde68a;"
                + "border-radius:6px;\"><tr><td style=\"padding:12px 16px;font-size:14px;color:#78350f;"
                + "line-height:1.55;word-break:break-word;\"><strong>" + esc(label) + "</strong> "
                + esc(value) + "</td></tr></table>";
    }

    /**
     * The employee table both admin summaries use.
     *
     * Long values wrap rather than being cut: an employee whose stored name runs to forty
     * characters is a record someone needs to fix, and truncating it in the one report an admin
     * actually reads would hide that. word-break keeps it from stretching the table instead.
     *
     * @param headers column headings
     * @param rows    one string per cell, same length as headers
     */
    static String table(List<String> headers, List<List<String>> rows) {
        StringBuilder h = new StringBuilder();
        h.append("<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" width=\"100%\" ")
                .append("style=\"border-collapse:collapse;border:1px solid ").append(LINE)
                .append(";border-radius:6px;\">");

        h.append("<tr>");
        for (String head : headers) {
            h.append("<th align=\"left\" style=\"padding:10px 14px;background:").append(TINT)
                    .append(";border-bottom:2px solid ").append(LINE)
                    .append(";font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:")
                    .append(MUTED).append(";\">").append(esc(head)).append("</th>");
        }
        h.append("</tr>");

        if (rows.isEmpty()) {
            h.append("<tr><td colspan=\"").append(headers.size())
                    .append("\" style=\"padding:14px;font-size:14px;color:").append(MUTED)
                    .append(";\">Nothing to report.</td></tr>");
        }
        for (int r = 0; r < rows.size(); r++) {
            // Zebra striping: these lists run to a dozen rows and the eye loses the line.
            String bg = r % 2 == 0 ? "#ffffff" : TINT;
            h.append("<tr style=\"background:").append(bg).append(";\">");
            List<String> cells = rows.get(r);
            for (int c = 0; c < cells.size(); c++) {
                boolean first = c == 0;
                h.append("<td style=\"padding:11px 14px;border-bottom:1px solid ").append(LINE)
                        .append(";font-size:13px;color:").append(first ? INK : MUTED)
                        .append(";").append(first ? "font-weight:600;" : "")
                        .append("word-break:break-word;vertical-align:top;\">")
                        .append(esc(blankTo(cells.get(c)))).append("</td>");
            }
            h.append("</tr>");
        }
        h.append("</table>");
        return h.toString();
    }

    /**
     * Escapes text for HTML.
     *
     * Applied to every interpolated value without exception. These bodies carry data typed by
     * people — employee names, a free-text rejection reason — and an unescaped apostrophe or
     * angle bracket would at best break the layout and at worst let markup out of a text field
     * and into the message.
     */
    static String esc(String raw) {
        if (raw == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(raw.length() + 16);
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            switch (c) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                // Body copy is assembled from parts; a stray newline inside a value would
                // otherwise collapse and run two lines together.
                case '\n' -> out.append("<br>");
                default -> out.append(c);
            }
        }
        return out.toString();
    }

    private static String blankTo(String v) {
        return present(v) ? v.trim() : "—";
    }

    private static boolean present(String v) {
        return v != null && !v.isBlank();
    }
}
