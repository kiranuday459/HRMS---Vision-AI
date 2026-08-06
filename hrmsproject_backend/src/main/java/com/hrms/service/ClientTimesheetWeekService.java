package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.dto.ClientTimesheetWeekDTO;
import com.hrms.dto.ClientTimesheetWeekSummaryDTO;
import com.hrms.model.*;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.ClientTimesheetWeekRepository;
import com.hrms.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Employee-facing Client Timesheet week logic: summary list, week detail, save draft,
 * submit. Writes line rows into the (extended) client_timesheets table and maintains a
 * client_timesheet_weeks header. Never touches the internal timesheets feature, and the
 * admin approve/reject (per line row) continues to work unchanged — the week's
 * employee-facing status is derived by merging the header intent with the line decisions.
 */
@Service
@Transactional
public class ClientTimesheetWeekService {

    // Time-off row types, in display order.
    private static final List<String> TIMEOFF_TYPES = List.of("SICK", "HOLIDAY", "PTO", "LOP", "EARNED");
    private static final int MAX_WEEKS = 104; // cap the generated summary list (~2 years)
    // Daily Regular-hours capacity, shared between leave taken and project hours worked.
    private static final double REGULAR_HOURS_PER_DAY = 8.0;
    // Hour caps, mirrored in the frontend by EntryPage's MAX_HOURS_PER_DAY / MAX_LEAVE_HOURS
    // _PER_DAY. The cell clamp there is a convenience; these are the rule, and they apply to
    // a direct API call just the same.
    private static final double MAX_HOURS_PER_DAY = 24.0;
    private static final double MAX_LEAVE_HOURS_PER_DAY = REGULAR_HOURS_PER_DAY;

    @Autowired
    private ClientTimesheetRepository lineRepository;

    @Autowired
    private ClientTimesheetWeekRepository weekRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private ClientProjectAssignmentService assignmentService;

    @Autowired
    private ClientTimesheetNotificationService notificationService;

    @Autowired
    private UserDisplayNameResolver userDisplayNameResolver;

    // ---- Week helpers (Saturday start → Friday end) ----
    private LocalDate weekStartOf(LocalDate date) {
        int offset = (date.getDayOfWeek().getValue() - DayOfWeek.SATURDAY.getValue() + 7) % 7;
        return date.minusDays(offset);
    }

    private boolean isTimeOff(String category) {
        return category != null && TIMEOFF_TYPES.contains(category.toUpperCase());
    }

    // =====================================================================
    // Summary list
    // =====================================================================
    public List<ClientTimesheetWeekSummaryDTO> getWeeks(Long employeeId) {
        LocalDate gate = assignmentService.earliestAssignmentDate(employeeId);

        // Load everything once, group in memory by week start.
        List<ClientTimesheet> allLines = lineRepository.findByEmployeeIdOrderByDateDesc(employeeId);
        Map<LocalDate, List<ClientTimesheet>> linesByWeek = new HashMap<>();
        for (ClientTimesheet l : allLines) {
            LocalDate ws = l.getWeekStartDate() != null ? l.getWeekStartDate() : weekStartOf(l.getDate());
            linesByWeek.computeIfAbsent(ws, k -> new ArrayList<>()).add(l);
        }
        Map<LocalDate, ClientTimesheetWeek> headerByWeek = new HashMap<>();
        for (ClientTimesheetWeek w : weekRepository.findByEmployeeIdOrderByWeekStartDateDesc(employeeId)) {
            headerByWeek.put(w.getWeekStartDate(), w);
        }

        // The employee's own saved/submitted weeks are always listed, whether or not an
        // ACTIVE assignment still backs them. The assignment gate alone used to decide the
        // whole list, so an assignment that was ended (active = false / NULL) hid weeks the
        // admin queue could still see and approve — the summary then rendered its
        // "no active client project assignment" empty state over real data.
        Set<LocalDate> dataWeeks = new HashSet<>();
        linesByWeek.keySet().stream().filter(Objects::nonNull).forEach(dataWeeks::add);
        headerByWeek.keySet().stream().filter(Objects::nonNull).forEach(dataWeeks::add);

        LocalDate gateWeek = gate != null ? weekStartOf(gate) : null;
        LocalDate earliestDataWeek = dataWeeks.stream().min(LocalDate::compareTo).orElse(null);
        LocalDate latestDataWeek = dataWeeks.stream().max(LocalDate::compareTo).orElse(null);

        // Oldest week to list: the assignment gate, or the employee's oldest record —
        // whichever reaches further back.
        LocalDate floor = gateWeek;
        if (earliestDataWeek != null && (floor == null || earliestDataWeek.isBefore(floor))) {
            floor = earliestDataWeek;
        }
        if (floor == null) {
            // Genuinely nothing: no active assignment AND no saved/submitted records.
            System.err.println("[ClientTimesheet] Empty summary served for employee " + employeeId
                    + " — no active client project assignment and no timesheet records.");
            return Collections.emptyList();
        }
        if (gateWeek == null) {
            // Records exist without an active assignment — the exact admin-sees-it /
            // employee-doesn't mismatch. Surfaced so it is traceable for a real user.
            System.err.println("[ClientTimesheet] Employee " + employeeId + " has "
                    + dataWeeks.size() + " client timesheet week(s) but NO active assignment"
                    + " (client_project_assignments.active). Listing records from " + floor + ".");
        }

        LocalDate cursor = weekStartOf(LocalDate.now());
        // Never start below a record the employee already has (e.g. a week carried over
        // from an earlier assignment period), or that week would be silently dropped.
        if (latestDataWeek != null && latestDataWeek.isAfter(cursor)) {
            cursor = latestDataWeek;
        }

        List<ClientTimesheetWeekSummaryDTO> out = new ArrayList<>();
        int count = 0;
        while (!cursor.isBefore(floor) && count < MAX_WEEKS) {
            List<ClientTimesheet> lines = linesByWeek.getOrDefault(cursor, Collections.emptyList());
            ClientTimesheetWeek header = headerByWeek.get(cursor);

            ClientTimesheetWeekSummaryDTO row = new ClientTimesheetWeekSummaryDTO();
            row.setWeekStartDate(cursor);
            row.setWeekEndDate(cursor.plusDays(6));

            double billable = 0, nonBillable = 0, timeOff = 0;
            for (ClientTimesheet l : lines) {
                double h = l.getHours() != null ? l.getHours() : 0;
                if (isTimeOff(l.getCategory())) {
                    timeOff += h;
                } else if (Boolean.TRUE.equals(l.getBillable())) {
                    billable += h;
                } else {
                    nonBillable += h;
                }
            }
            row.setBillableProjectHours(billable);
            row.setNonBillableProjectHours(nonBillable);
            row.setTimeOffHolidayHours(timeOff);
            row.setTruTimeHours(null); // N/A
            row.setStatus(deriveStatus(header, lines));
            row.setRejectionReason(latestRejectionReason(lines));
            out.add(row);

            cursor = cursor.minusWeeks(1);
            count++;
        }
        return out; // already newest-first (started from current week)
    }

    /**
     * Employee-facing status for a week (display-only string). A week with no saved line
     * entries is NOT_STARTED — never "Pending" — so unfilled weeks don't look submitted.
     *   no entries                → NOT_STARTED
     *   entries saved, unsubmitted → DRAFT
     *   any entry submitted        → PENDING (awaiting admin approval)
     *   all entries approved       → APPROVED
     *   any entry rejected         → REJECTED
     */
    /**
     * Most recent rejection reason across a week's line rows, or null if none carries one.
     * Admin reject acts per day row, so a week can hold several copies of the same reason
     * (and older ones from earlier rejections) — the latest review wins. Rows without a
     * reviewedAt sort last so a stamped decision always beats an unstamped one.
     */
    private String latestRejectionReason(List<ClientTimesheet> lines) {
        return lines.stream()
                .filter(l -> l.getStatus() == ClientTimesheetStatus.REJECTED)
                .filter(l -> l.getRejectionReason() != null && !l.getRejectionReason().isBlank())
                .max(Comparator.comparing(ClientTimesheet::getReviewedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(ClientTimesheet::getRejectionReason)
                .orElse(null);
    }

    private String deriveStatus(ClientTimesheetWeek header, List<ClientTimesheet> lines) {
        if (lines.isEmpty()) {
            return "NOT_STARTED"; // week exists in the list but nothing was ever saved
        }
        boolean anyRejected = lines.stream().anyMatch(l -> l.getStatus() == ClientTimesheetStatus.REJECTED);
        if (anyRejected) return "REJECTED";
        boolean anyPending = lines.stream().anyMatch(l -> l.getStatus() == ClientTimesheetStatus.PENDING);
        if (anyPending) return "PENDING";
        boolean allApproved = lines.stream().allMatch(l -> l.getStatus() == ClientTimesheetStatus.APPROVED);
        if (allApproved) return "APPROVED";
        return "DRAFT"; // saved but not yet submitted
    }

    // =====================================================================
    // Week detail (entry page)
    // =====================================================================
    public ClientTimesheetWeekDTO getWeekDetail(Long employeeId, LocalDate weekStart) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        LocalDate weekStartDate = weekStartOf(weekStart);
        LocalDate weekEndDate = weekStartDate.plusDays(6);

        List<ClientTimesheet> lines = lineRepository.findByEmployeeIdAndWeekStartDate(employeeId, weekStartDate);
        List<ClientProjectAssignmentDTO> assignments = assignmentService.getActiveForEmployee(employeeId);
        ClientTimesheetWeek header = weekRepository.findByEmployeeIdAndWeekStartDate(employeeId, weekStartDate).orElse(null);

        ClientTimesheetWeekDTO dto = new ClientTimesheetWeekDTO();
        dto.setEmployeeId(employeeId);
        dto.setEmployeeName((employee.getFirstName() + " "
                + (employee.getLastName() == null ? "" : employee.getLastName())).trim());
        // Null-safe: the column defaults to true, but older rows may predate it.
        dto.setEmployeeActive(!Boolean.FALSE.equals(employee.getActive()));
        dto.setWeekStartDate(weekStartDate);
        dto.setWeekEndDate(weekEndDate);
        dto.setEarliestAssignmentDate(assignmentService.earliestAssignmentDate(employeeId));
        dto.setStatus(deriveStatus(header, lines));
        dto.setRejectionReason(latestRejectionReason(lines));

        List<LocalDate> weekDays = new ArrayList<>();
        for (int i = 0; i < 7; i++) weekDays.add(weekStartDate.plusDays(i));

        // ---- Project rows: group saved day-lines by stable row id (multiple rows per project) ----
        List<ClientTimesheet> projectLines = new ArrayList<>();
        for (ClientTimesheet l : lines) {
            if (!isTimeOff(l.getCategory())) {
                projectLines.add(l);
            }
        }

        Map<String, List<ClientTimesheet>> linesByRowId = new LinkedHashMap<>();
        for (ClientTimesheet l : projectLines) {
            String rowKey = rowKeyForLine(l);
            linesByRowId.computeIfAbsent(rowKey, k -> new ArrayList<>()).add(l);
        }

        Map<String, ClientProjectAssignmentDTO> assignmentByProject = new HashMap<>();
        for (ClientProjectAssignmentDTO a : assignments) {
            if (a.getProjectId() != null) {
                assignmentByProject.put(a.getProjectId(), a);
            }
        }

        List<ClientTimesheetWeekDTO.ProjectRowDTO> projectRows = new ArrayList<>();
        Set<String> projectIdsWithRows = new LinkedHashSet<>();
        for (List<ClientTimesheet> group : linesByRowId.values()) {
            ClientTimesheetWeekDTO.ProjectRowDTO row = buildProjectRowFromSavedLines(group, weekDays);
            ClientProjectAssignmentDTO a = assignmentByProject.get(row.getProjectId());
            if (row.getAssignmentStartDate() == null && a != null) {
                row.setAssignmentStartDate(a.getAssignmentStartDate());
            }
            if (row.getAssignmentStartDate() == null) {
                row.setAssignmentStartDate(dto.getEarliestAssignmentDate());
            }
            projectRows.add(row);
            if (row.getProjectId() != null) {
                projectIdsWithRows.add(row.getProjectId());
            }
        }

        // Template rows for active assignments that have no saved lines yet this week.
        for (ClientProjectAssignmentDTO a : assignments) {
            String pid = a.getProjectId() != null ? a.getProjectId() : "";
            if (!projectIdsWithRows.contains(pid)) {
                projectRows.add(buildProjectRowTemplate(a.getProjectId(), a.getProjectName(), a.getTaskId(),
                        a.getTaskDescription(), a.getOnsiteOffshore(), a.getClientBillable(), a.getBillingLocation(),
                        a.getAssignmentStartDate(), weekDays));
                projectIdsWithRows.add(pid);
            }
        }
        dto.setProjectRows(projectRows);

        // ---- Time-off rows: fixed 5 types, overlay saved ----
        Map<String, ClientTimesheet> savedTimeOffByKey = new HashMap<>();
        for (ClientTimesheet l : lines) {
            if (isTimeOff(l.getCategory())) {
                savedTimeOffByKey.put(l.getCategory().toUpperCase() + "|" + l.getDate(), l);
            }
        }
        List<ClientTimesheetWeekDTO.TimeOffRowDTO> timeOffRows = new ArrayList<>();
        for (String type : TIMEOFF_TYPES) {
            ClientTimesheetWeekDTO.TimeOffRowDTO row = new ClientTimesheetWeekDTO.TimeOffRowDTO();
            row.setType(type);
            double total = 0;
            List<ClientTimesheetWeekDTO.DayHourDTO> days = new ArrayList<>();
            for (LocalDate d : weekDays) {
                ClientTimesheet saved = savedTimeOffByKey.get(type + "|" + d);
                double h = saved != null && saved.getHours() != null ? saved.getHours() : 0;
                ClientTimesheetWeekDTO.DayHourDTO dh = new ClientTimesheetWeekDTO.DayHourDTO();
                dh.setDate(d);
                dh.setHours(h);
                days.add(dh);
                total += h;
            }
            row.setDays(days);
            row.setTotalHours(total);
            timeOffRows.add(row);
        }
        dto.setTimeOffRows(timeOffRows);

        applyTotals(dto);
        return dto;
    }

    /**
     * Admin read-only detail for a single client-timesheet line: the full week the line
     * belongs to (project rows + time-off, from {@link #getWeekDetail}), plus header meta
     * (employee, project, submitted, and the clicked line's status). Read-only.
     */
    public ClientTimesheetWeekDTO getAdminDetail(Long lineId) {
        ClientTimesheet line = lineRepository.findById(lineId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client timesheet not found"));
        Employee employee = line.getEmployee();
        Long employeeId = employee != null ? employee.getId() : null;
        LocalDate weekStart = line.getWeekStartDate() != null ? line.getWeekStartDate() : weekStartOf(line.getDate());

        ClientTimesheetWeekDTO dto = getWeekDetail(employeeId, weekStart);
        dto.setLineId(line.getId());
        dto.setProjectName(line.getProjectName());
        dto.setProjectId(line.getProjectId());
        // Show the clicked row's status (matches the list); approve/reject act on this line.
        dto.setStatus(line.getStatus() != null ? line.getStatus().name() : dto.getStatus());
        dto.setSubmittedAt(line.getSubmittedAt() != null ? line.getSubmittedAt().toString() : null);
        // The reviewer and the moment of the decision — the record of who approved or
        // rejected this week, which the detail view previously omitted entirely.
        dto.setApprovedByName(userDisplayNameResolver.resolve(line.getApprovedBy()));
        dto.setReviewedAt(line.getReviewedAt() != null ? line.getReviewedAt().toString() : null);
        // Prefer the clicked row's own reason so it stays consistent with the status above;
        // otherwise keep the week-level fallback already set by getWeekDetail.
        if (line.getRejectionReason() != null && !line.getRejectionReason().isBlank()) {
            dto.setRejectionReason(line.getRejectionReason());
        }
        return dto;
    }

    /** Row grouping key for persisted day-lines (supports many rows per project). */
    private String rowKeyForLine(ClientTimesheet line) {
        if (line.getProjectRowId() != null && !line.getProjectRowId().isBlank()) {
            return line.getProjectRowId();
        }
        String pid = line.getProjectId() != null ? line.getProjectId() : "";
        return "legacy:" + pid;
    }

    private ClientTimesheetWeekDTO.ProjectRowDTO buildProjectRowFromSavedLines(List<ClientTimesheet> group,
            List<LocalDate> weekDays) {
        ClientTimesheet sample = group.get(0);
        Map<LocalDate, ClientTimesheet> byDate = new HashMap<>();
        for (ClientTimesheet l : group) {
            byDate.put(l.getDate(), l);
        }
        String rowId = sample.getProjectRowId() != null && !sample.getProjectRowId().isBlank()
                ? sample.getProjectRowId()
                : rowKeyForLine(sample);
        return buildProjectRowCore(rowId, sample.getProjectId(), sample.getProjectName(), sample.getTaskId(),
                sample.getTaskDescription(), sample.getOnsiteOffshore(),
                Boolean.TRUE.equals(sample.getBillable()) ? "BILLABLE" : "NON_BILLABLE",
                sample.getBillingLocation(), null, weekDays, byDate, sample.getComment());
    }

    private ClientTimesheetWeekDTO.ProjectRowDTO buildProjectRowTemplate(String projectId, String projectName,
            String taskId, String taskDescription, String onsiteOffshore, String clientBillable,
            String billingLocation, LocalDate assignmentStartDate, List<LocalDate> weekDays) {
        return buildProjectRowCore(null, projectId, projectName, taskId, taskDescription, onsiteOffshore,
                clientBillable, billingLocation, assignmentStartDate, weekDays, Collections.emptyMap(), null);
    }

    private ClientTimesheetWeekDTO.ProjectRowDTO buildProjectRowCore(String rowId, String projectId, String projectName,
            String taskId, String taskDescription, String onsiteOffshore, String clientBillable,
            String billingLocation, LocalDate assignmentStartDate, List<LocalDate> weekDays,
            Map<LocalDate, ClientTimesheet> savedByDate, String comment) {
        ClientTimesheetWeekDTO.ProjectRowDTO row = new ClientTimesheetWeekDTO.ProjectRowDTO();
        row.setRowId(rowId);
        row.setProjectId(projectId);
        row.setProjectName(projectName);
        row.setTaskId(taskId);
        row.setTaskDescription(taskDescription);
        row.setOnsiteOffshore(onsiteOffshore != null ? onsiteOffshore : "ONSITE");
        row.setClientBillable(clientBillable != null ? clientBillable : "BILLABLE");
        row.setBillingLocation(billingLocation != null ? billingLocation : null);
        row.setAssignmentStartDate(assignmentStartDate);
        row.setComment(comment);
        double total = 0;
        List<ClientTimesheetWeekDTO.DayHourDTO> days = new ArrayList<>();
        for (LocalDate d : weekDays) {
            ClientTimesheet saved = savedByDate.get(d);
            double h = saved != null && saved.getHours() != null ? saved.getHours() : 0;
            ClientTimesheetWeekDTO.DayHourDTO dh = new ClientTimesheetWeekDTO.DayHourDTO();
            dh.setDate(d);
            dh.setHours(h);
            days.add(dh);
            total += h;
        }
        row.setDays(days);
        row.setTotalHours(total);
        return row;
    }

    private void applyTotals(ClientTimesheetWeekDTO dto) {
        double billable = 0, nonBillable = 0, timeOff = 0;
        for (ClientTimesheetWeekDTO.ProjectRowDTO r : dto.getProjectRows()) {
            double rowTotal = r.getDays().stream().mapToDouble(d -> d.getHours() != null ? d.getHours() : 0).sum();
            r.setTotalHours(rowTotal);
            if ("NON_BILLABLE".equalsIgnoreCase(r.getClientBillable())) nonBillable += rowTotal;
            else billable += rowTotal;
        }
        for (ClientTimesheetWeekDTO.TimeOffRowDTO r : dto.getTimeOffRows()) {
            double rowTotal = r.getDays().stream().mapToDouble(d -> d.getHours() != null ? d.getHours() : 0).sum();
            r.setTotalHours(rowTotal);
            timeOff += rowTotal;
        }
        dto.setTotalBillableHours(billable);
        dto.setTotalNonBillableHours(nonBillable);
        dto.setTotalTimeOffHours(timeOff);
        dto.setGrandTotal(billable + nonBillable + timeOff);
        applyRegularAndOvertime(dto);
    }

    /**
     * Splits the week into Regular and Overtime using the daily 8-hour regular capacity,
     * which leave and worked project hours share:
     * <ul>
     *   <li>full-day leave (>= 8h) → Regular 8, OT 0 for that day, whatever else is entered</li>
     *   <li>otherwise → Regular = leave + min(worked, 8 - leave); OT = the worked remainder</li>
     * </ul>
     * Weekends carry no Regular or Overtime (they are locked for entry).
     *
     * Always recomputed here, so whatever the client sent is overwritten — the approval
     * queue reads these figures and must not be able to be told what they are.
     * Mirrors the client-side dayBreakdown in EntryPage.jsx; keep the two in step.
     */
    private void applyRegularAndOvertime(ClientTimesheetWeekDTO dto) {
        Map<LocalDate, Double> workedByDay = new HashMap<>();
        Map<LocalDate, Double> leaveByDay = new HashMap<>();

        for (ClientTimesheetWeekDTO.ProjectRowDTO r : dto.getProjectRows()) {
            for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                if (d.getDate() == null) continue;
                workedByDay.merge(d.getDate(), d.getHours() != null ? d.getHours() : 0, Double::sum);
            }
        }
        for (ClientTimesheetWeekDTO.TimeOffRowDTO r : dto.getTimeOffRows()) {
            for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                if (d.getDate() == null) continue;
                leaveByDay.merge(d.getDate(), d.getHours() != null ? d.getHours() : 0, Double::sum);
            }
        }

        Set<LocalDate> allDays = new HashSet<>(workedByDay.keySet());
        allDays.addAll(leaveByDay.keySet());

        double regular = 0, overtime = 0;
        for (LocalDate day : allDays) {
            DayOfWeek dow = day.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) continue;

            double worked = workedByDay.getOrDefault(day, 0.0);
            double leave = leaveByDay.getOrDefault(day, 0.0);

            if (leave >= REGULAR_HOURS_PER_DAY) {
                regular += REGULAR_HOURS_PER_DAY;
                continue; // full-day leave earns no overtime
            }
            double capacity = REGULAR_HOURS_PER_DAY - leave;
            regular += leave + Math.min(worked, capacity);
            overtime += Math.max(0, worked - capacity);
        }

        dto.setTotalRegularHours(regular);
        dto.setTotalOtHours(overtime);
    }

    // =====================================================================
    // Save draft / submit
    // =====================================================================
    public ClientTimesheetWeekDTO saveDraft(Long employeeId, ClientTimesheetWeekDTO payload) {
        return persist(employeeId, payload, false);
    }

    public ClientTimesheetWeekDTO submit(Long employeeId, LocalDate weekStart, ClientTimesheetWeekDTO payload) {
        return persist(employeeId, payload, true);
    }

    private ClientTimesheetWeekDTO persist(Long employeeId, ClientTimesheetWeekDTO payload, boolean submit) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        LocalDate weekStartDate = weekStartOf(payload.getWeekStartDate());
        LocalDate weekEndDate = weekStartDate.plusDays(6);
        LocalDate today = LocalDate.now();
        LocalDate gate = assignmentService.earliestAssignmentDate(employeeId);

        // Don't allow editing an already-approved week.
        ClientTimesheetWeek header = weekRepository.findByEmployeeIdAndWeekStartDate(employeeId, weekStartDate)
                .orElseGet(() -> {
                    ClientTimesheetWeek w = new ClientTimesheetWeek();
                    w.setEmployee(employee);
                    w.setWeekStartDate(weekStartDate);
                    w.setWeekEndDate(weekEndDate);
                    return w;
                });
        List<ClientTimesheet> existing = lineRepository.findByEmployeeIdAndWeekStartDate(employeeId, weekStartDate);
        if (existing.stream().anyMatch(l -> l.getStatus() == ClientTimesheetStatus.APPROVED)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This week is already approved and cannot be edited.");
        }
        // Read the pre-existing state before the rows are replaced: a week that was
        // rejected and is now being sent back is a resubmission, not a first submission.
        boolean resubmission = existing.stream().anyMatch(l -> l.getStatus() == ClientTimesheetStatus.REJECTED);

        // ---- Validate all non-zero entries against the assignment gate + future ----
        validateEntries(payload, gate, today);

        // Replace existing (non-approved) line rows for the week.
        if (!existing.isEmpty()) {
            lineRepository.deleteAll(existing);
            lineRepository.flush();
        }

        ClientTimesheetStatus lineStatus = submit ? ClientTimesheetStatus.PENDING : ClientTimesheetStatus.DRAFT;
        List<ClientTimesheet> toSave = new ArrayList<>();

        if (payload.getProjectRows() != null) {
            for (ClientTimesheetWeekDTO.ProjectRowDTO r : payload.getProjectRows()) {
                boolean billable = !"NON_BILLABLE".equalsIgnoreCase(r.getClientBillable());
                String rowId = r.getRowId();
                if (rowId == null || rowId.isBlank()) {
                    rowId = UUID.randomUUID().toString();
                }
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    if (h <= 0) continue;
                    ClientTimesheet line = new ClientTimesheet();
                    line.setEmployee(employee);
                    line.setDate(d.getDate());
                    line.setWeekStartDate(weekStartDate);
                    line.setWeekEndDate(weekEndDate);
                    line.setProjectRowId(rowId);
                    line.setProjectId(r.getProjectId());
                    line.setProjectName(r.getProjectName());
                    line.setTaskId(r.getTaskId());
                    line.setTaskDescription(r.getTaskDescription());
                    line.setTask(r.getTaskDescription());
                    line.setOnsiteOffshore(r.getOnsiteOffshore());
                    line.setBillingLocation(r.getBillingLocation());
                    line.setBillable(billable);
                    line.setHours(h);
                    line.setComment(r.getComment());
                    line.setCategory("PROJECT");
                    line.setStatus(lineStatus);
                    if (submit) line.setSubmittedAt(LocalDateTime.now());
                    toSave.add(line);
                }
            }
        }

        if (payload.getTimeOffRows() != null) {
            for (ClientTimesheetWeekDTO.TimeOffRowDTO r : payload.getTimeOffRows()) {
                String type = r.getType() != null ? r.getType().toUpperCase() : "";
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    if (h <= 0) continue;
                    ClientTimesheet line = new ClientTimesheet();
                    line.setEmployee(employee);
                    line.setDate(d.getDate());
                    line.setWeekStartDate(weekStartDate);
                    line.setWeekEndDate(weekEndDate);
                    line.setCategory(type);
                    line.setBillable(null);
                    line.setHours(h);
                    line.setStatus(lineStatus);
                    if (submit) line.setSubmittedAt(LocalDateTime.now());
                    toSave.add(line);
                }
            }
        }

        // Compute totals for the header.
        applyTotals(payload);
        header.setEmployee(employee);
        header.setStatus(submit ? ClientTimesheetStatus.PENDING : ClientTimesheetStatus.DRAFT);
        header.setTotalBillableHours(payload.getTotalBillableHours());
        header.setTotalNonBillableHours(payload.getTotalNonBillableHours());
        header.setTotalTimeoffHours(payload.getTotalTimeOffHours());
        // applyTotals() has just recomputed these from the payload's day hours.
        header.setTotalRegularHours(payload.getTotalRegularHours());
        header.setTotalOtHours(payload.getTotalOtHours());
        header.setGrandTotal(payload.getGrandTotal());
        if (submit) header.setSubmittedAt(LocalDateTime.now());
        ClientTimesheetWeek savedHeader = weekRepository.save(header);

        for (ClientTimesheet l : toSave) {
            l.setWeekId(savedHeader.getId());
        }
        lineRepository.saveAll(toSave);

        // Side effect only — the submit itself is already complete and the notification
        // service swallows its own failures, so a bell problem can never fail a submit.
        if (submit) {
            notificationService.notifyAdminsTimesheetSubmitted(employee, weekStartDate, resubmission);
        }

        return getWeekDetail(employeeId, weekStartDate);
    }

    // Agreed field character limits. Enforced here rather than trusted from the client: the
    // frontend caps these inputs with maxLength, but a direct API call bypasses that entirely,
    // so this is the actual contract. Overrunning them used to reach MySQL and surface as a
    // raw 500 "Data too long for column", so they are rejected with a message instead.
    // Mirrored in the frontend by utils/fieldLimits.js — keep the two in step.
    private static final int MAX_PROJECT_ID = 25;
    private static final int MAX_PROJECT_NAME = 50;
    private static final int MAX_TASK_ID = 25;
    private static final int MAX_TASK_DESCRIPTION = 256;
    private static final int MAX_COMMENT = 256;
    // Not part of the agreed limits table; unchanged, and still matches its VARCHAR(64) column.
    private static final int MAX_BILLING_LOCATION = 64;

    private void requireMaxLength(String value, int max, String fieldLabel) {
        if (value != null && value.length() > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    fieldLabel + " must be " + max + " characters or fewer (currently " + value.length() + ").");
        }
    }

    /**
     * Rejects any entry (hours > 0) dated before the applicable assignment start date, or
     * in the future. Project rows use their own assignmentStartDate; time-off rows use the
     * global earliest assignment date.
     */
    // Package-private rather than private so the field-limit rules can be exercised directly
    // in ClientTimesheetFieldLimitsTest — it takes no repositories, so it tests without a DB.
    void validateEntries(ClientTimesheetWeekDTO payload, LocalDate gate, LocalDate today) {
        // Per-date running totals, so the daily caps can be checked across every row once the
        // individual cells have been vetted.
        Map<LocalDate, Double> workedByDay = new HashMap<>();
        Map<LocalDate, Double> leaveByDay = new HashMap<>();

        if (payload.getProjectRows() != null) {
            for (ClientTimesheetWeekDTO.ProjectRowDTO r : payload.getProjectRows()) {
                requireMaxLength(r.getProjectId(), MAX_PROJECT_ID, "Project ID");
                requireMaxLength(r.getProjectName(), MAX_PROJECT_NAME, "Project Name");
                requireMaxLength(r.getTaskId(), MAX_TASK_ID, "Task/Activity ID");
                requireMaxLength(r.getTaskDescription(), MAX_TASK_DESCRIPTION, "Task/Activity Description");
                requireMaxLength(r.getComment(), MAX_COMMENT, "Comment");
                requireMaxLength(r.getBillingLocation(), MAX_BILLING_LOCATION, "Billing Location");
                LocalDate rowGate = r.getAssignmentStartDate() != null ? r.getAssignmentStartDate() : gate;
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    requireHourRange(h, MAX_HOURS_PER_DAY, "Hours", d.getDate());
                    if (h <= 0) continue;
                    if (rowGate != null && d.getDate().isBefore(rowGate)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours before your client assignment date.");
                    }
                    if (d.getDate().isAfter(today)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours for future dates.");
                    }
                    workedByDay.merge(d.getDate(), h, Double::sum);
                }
            }
        }
        if (payload.getTimeOffRows() != null) {
            for (ClientTimesheetWeekDTO.TimeOffRowDTO r : payload.getTimeOffRows()) {
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    requireHourRange(h, MAX_LEAVE_HOURS_PER_DAY, "Leave hours", d.getDate());
                    if (h <= 0) continue;
                    if (gate != null && d.getDate().isBefore(gate)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours before your client assignment date.");
                    }
                    if (d.getDate().isAfter(today)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours for future dates.");
                    }
                    leaveByDay.merge(d.getDate(), h, Double::sum);
                }
            }
        }

        // Daily caps across every row. The per-cell checks above cannot catch these: eight
        // project rows of 8h each are individually legal but add up to 64 hours in one day.
        Set<LocalDate> dates = new HashSet<>(workedByDay.keySet());
        dates.addAll(leaveByDay.keySet());
        for (LocalDate date : dates) {
            double leave = leaveByDay.getOrDefault(date, 0.0);
            if (leave > MAX_LEAVE_HOURS_PER_DAY) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Leave on " + date + " totals " + hrs(leave)
                                + " hours across the leave rows; the daily maximum is "
                                + hrs(MAX_LEAVE_HOURS_PER_DAY) + ".");
            }
            // Leave and worked hours occupy the same calendar day, so they share the 24h cap.
            double total = workedByDay.getOrDefault(date, 0.0) + leave;
            if (total > MAX_HOURS_PER_DAY) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        date + " totals " + hrs(total) + " hours across all rows; a day cannot exceed "
                                + hrs(MAX_HOURS_PER_DAY) + ".");
            }
        }
    }

    /** Rejects a single cell that is negative or over its cap. */
    private void requireHourRange(double hours, double max, String label, LocalDate date) {
        if (hours < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    label + " cannot be negative (" + date + " has " + hrs(hours) + ").");
        }
        if (hours > max) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    label + " cannot exceed " + hrs(max) + " for a single day (" + date
                            + " has " + hrs(hours) + ").");
        }
    }

    /** Whole hours read better than "24.0" in a message the employee sees. */
    private static String hrs(double v) {
        return v == Math.rint(v) ? String.valueOf((long) v) : String.valueOf(v);
    }
}
