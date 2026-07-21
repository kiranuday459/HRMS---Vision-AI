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

    @Autowired
    private ClientTimesheetRepository lineRepository;

    @Autowired
    private ClientTimesheetWeekRepository weekRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private ClientProjectAssignmentService assignmentService;

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
        if (gate == null) {
            // No active client assignment → no weeks to show.
            return Collections.emptyList();
        }

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

        LocalDate cursor = weekStartOf(LocalDate.now());
        LocalDate gateWeek = weekStartOf(gate);

        List<ClientTimesheetWeekSummaryDTO> out = new ArrayList<>();
        int count = 0;
        while (!cursor.isBefore(gateWeek) && count < MAX_WEEKS) {
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
        dto.setWeekStartDate(weekStartDate);
        dto.setWeekEndDate(weekEndDate);
        dto.setEarliestAssignmentDate(assignmentService.earliestAssignmentDate(employeeId));
        dto.setStatus(deriveStatus(header, lines));

        List<LocalDate> weekDays = new ArrayList<>();
        for (int i = 0; i < 7; i++) weekDays.add(weekStartDate.plusDays(i));

        // ---- Project rows: start from active assignments, overlay saved hours ----
        // Saved project lines keyed by projectId+date.
        Map<String, ClientTimesheet> savedProjectByKey = new HashMap<>();
        Set<String> savedProjectIds = new LinkedHashSet<>();
        for (ClientTimesheet l : lines) {
            if (!isTimeOff(l.getCategory())) {
                String pid = l.getProjectId() != null ? l.getProjectId() : "";
                savedProjectByKey.put(pid + "|" + l.getDate(), l);
                savedProjectIds.add(pid);
            }
        }

        List<ClientTimesheetWeekDTO.ProjectRowDTO> projectRows = new ArrayList<>();
        Set<String> emittedProjectIds = new LinkedHashSet<>();
        for (ClientProjectAssignmentDTO a : assignments) {
            projectRows.add(buildProjectRow(a.getProjectId(), a.getProjectName(), a.getTaskId(),
                    a.getTaskDescription(), a.getOnsiteOffshore(), a.getClientBillable(), a.getBillingLocation(),
                    a.getAssignmentStartDate(), weekDays, savedProjectByKey));
            emittedProjectIds.add(a.getProjectId() != null ? a.getProjectId() : "");
        }
        // Include any saved project rows whose project is no longer an active assignment
        // (so a saved draft is never lost).
        for (String pid : savedProjectIds) {
            if (!emittedProjectIds.contains(pid)) {
                ClientTimesheet sample = lines.stream()
                        .filter(l -> !isTimeOff(l.getCategory()) && Objects.equals(l.getProjectId() != null ? l.getProjectId() : "", pid))
                        .findFirst().orElse(null);
                if (sample != null) {
                    projectRows.add(buildProjectRow(sample.getProjectId(), sample.getProjectName(), sample.getTaskId(),
                            sample.getTaskDescription(), sample.getOnsiteOffshore(),
                            Boolean.TRUE.equals(sample.getBillable()) ? "BILLABLE" : "NON_BILLABLE",
                            sample.getBillingLocation(), dto.getEarliestAssignmentDate(), weekDays, savedProjectByKey));
                }
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
        return dto;
    }

    private ClientTimesheetWeekDTO.ProjectRowDTO buildProjectRow(String projectId, String projectName,
            String taskId, String taskDescription, String onsiteOffshore, String clientBillable,
            String billingLocation, LocalDate assignmentStartDate, List<LocalDate> weekDays,
            Map<String, ClientTimesheet> savedByKey) {
        ClientTimesheetWeekDTO.ProjectRowDTO row = new ClientTimesheetWeekDTO.ProjectRowDTO();
        row.setProjectId(projectId);
        row.setProjectName(projectName);
        row.setTaskId(taskId);
        row.setTaskDescription(taskDescription);
        row.setOnsiteOffshore(onsiteOffshore != null ? onsiteOffshore : "ONSITE");
        row.setClientBillable(clientBillable != null ? clientBillable : "BILLABLE");
        row.setBillingLocation(billingLocation != null ? billingLocation : null);
        row.setAssignmentStartDate(assignmentStartDate);
        String pid = projectId != null ? projectId : "";
        double total = 0;
        List<ClientTimesheetWeekDTO.DayHourDTO> days = new ArrayList<>();
        String comment = null;
        for (LocalDate d : weekDays) {
            ClientTimesheet saved = savedByKey.get(pid + "|" + d);
            double h = saved != null && saved.getHours() != null ? saved.getHours() : 0;
            if (saved != null && saved.getComment() != null) comment = saved.getComment();
            ClientTimesheetWeekDTO.DayHourDTO dh = new ClientTimesheetWeekDTO.DayHourDTO();
            dh.setDate(d);
            dh.setHours(h);
            days.add(dh);
            total += h;
        }
        row.setDays(days);
        row.setTotalHours(total);
        row.setComment(comment);
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
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    if (h <= 0) continue;
                    ClientTimesheet line = new ClientTimesheet();
                    line.setEmployee(employee);
                    line.setDate(d.getDate());
                    line.setWeekStartDate(weekStartDate);
                    line.setWeekEndDate(weekEndDate);
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
        header.setGrandTotal(payload.getGrandTotal());
        if (submit) header.setSubmittedAt(LocalDateTime.now());
        ClientTimesheetWeek savedHeader = weekRepository.save(header);

        for (ClientTimesheet l : toSave) {
            l.setWeekId(savedHeader.getId());
        }
        lineRepository.saveAll(toSave);

        return getWeekDetail(employeeId, weekStartDate);
    }

    /**
     * Rejects any entry (hours > 0) dated before the applicable assignment start date, or
     * in the future. Project rows use their own assignmentStartDate; time-off rows use the
     * global earliest assignment date.
     */
    private void validateEntries(ClientTimesheetWeekDTO payload, LocalDate gate, LocalDate today) {
        if (payload.getProjectRows() != null) {
            for (ClientTimesheetWeekDTO.ProjectRowDTO r : payload.getProjectRows()) {
                LocalDate rowGate = r.getAssignmentStartDate() != null ? r.getAssignmentStartDate() : gate;
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    if (h <= 0) continue;
                    if (rowGate != null && d.getDate().isBefore(rowGate)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours before your client assignment date.");
                    }
                    if (d.getDate().isAfter(today)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours for future dates.");
                    }
                }
            }
        }
        if (payload.getTimeOffRows() != null) {
            for (ClientTimesheetWeekDTO.TimeOffRowDTO r : payload.getTimeOffRows()) {
                for (ClientTimesheetWeekDTO.DayHourDTO d : r.getDays()) {
                    double h = d.getHours() != null ? d.getHours() : 0;
                    if (h <= 0) continue;
                    if (gate != null && d.getDate().isBefore(gate)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours before your client assignment date.");
                    }
                    if (d.getDate().isAfter(today)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot enter hours for future dates.");
                    }
                }
            }
        }
    }
}
