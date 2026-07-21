package com.hrms.dto;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Full week detail for the Client Timesheet entry page, and the payload for
 * save-draft / submit. Contains the project rows and the holiday/time-off rows,
 * each carrying a list of per-day hours.
 */
public class ClientTimesheetWeekDTO {

    private Long employeeId;
    private String employeeName;
    private LocalDate weekStartDate;
    private LocalDate weekEndDate;
    private String status;

    // Admin detail extras (set when viewed from the admin approval queue).
    private Long lineId;
    private String projectName;
    private String projectId;
    private String submittedAt;

    // Global gate: earliest active assignment date. Day cells before this are locked.
    private LocalDate earliestAssignmentDate;

    private List<ProjectRowDTO> projectRows = new ArrayList<>();
    private List<TimeOffRowDTO> timeOffRows = new ArrayList<>();

    private Double totalBillableHours;
    private Double totalNonBillableHours;
    private Double totalTimeOffHours;
    private Double grandTotal;

    public static class DayHourDTO {
        private LocalDate date;
        private Double hours;

        public LocalDate getDate() { return date; }
        public void setDate(LocalDate date) { this.date = date; }
        public Double getHours() { return hours; }
        public void setHours(Double hours) { this.hours = hours; }
    }

    public static class ProjectRowDTO {
        private String projectId;
        private String projectName;
        private String taskId;
        private String taskDescription;
        private String onsiteOffshore;
        private String clientBillable; // BILLABLE / NON_BILLABLE
        private String billingLocation;
        private String comment;
        private LocalDate assignmentStartDate; // per-row gate
        private Double totalHours;
        private List<DayHourDTO> days = new ArrayList<>();

        public String getProjectId() { return projectId; }
        public void setProjectId(String projectId) { this.projectId = projectId; }
        public String getProjectName() { return projectName; }
        public void setProjectName(String projectName) { this.projectName = projectName; }
        public String getTaskId() { return taskId; }
        public void setTaskId(String taskId) { this.taskId = taskId; }
        public String getTaskDescription() { return taskDescription; }
        public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }
        public String getOnsiteOffshore() { return onsiteOffshore; }
        public void setOnsiteOffshore(String onsiteOffshore) { this.onsiteOffshore = onsiteOffshore; }
        public String getClientBillable() { return clientBillable; }
        public void setClientBillable(String clientBillable) { this.clientBillable = clientBillable; }
        public String getBillingLocation() { return billingLocation; }
        public void setBillingLocation(String billingLocation) { this.billingLocation = billingLocation; }
        public String getComment() { return comment; }
        public void setComment(String comment) { this.comment = comment; }
        public LocalDate getAssignmentStartDate() { return assignmentStartDate; }
        public void setAssignmentStartDate(LocalDate assignmentStartDate) { this.assignmentStartDate = assignmentStartDate; }
        public Double getTotalHours() { return totalHours; }
        public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }
        public List<DayHourDTO> getDays() { return days; }
        public void setDays(List<DayHourDTO> days) { this.days = days; }
    }

    public static class TimeOffRowDTO {
        private String type; // SICK / HOLIDAY / PTO / LOP / EARNED
        private Double totalHours;
        private List<DayHourDTO> days = new ArrayList<>();

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Double getTotalHours() { return totalHours; }
        public void setTotalHours(Double totalHours) { this.totalHours = totalHours; }
        public List<DayHourDTO> getDays() { return days; }
        public void setDays(List<DayHourDTO> days) { this.days = days; }
    }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }
    public String getEmployeeName() { return employeeName; }
    public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
    public LocalDate getWeekStartDate() { return weekStartDate; }
    public void setWeekStartDate(LocalDate weekStartDate) { this.weekStartDate = weekStartDate; }
    public LocalDate getWeekEndDate() { return weekEndDate; }
    public void setWeekEndDate(LocalDate weekEndDate) { this.weekEndDate = weekEndDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getLineId() { return lineId; }
    public void setLineId(Long lineId) { this.lineId = lineId; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }
    public String getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(String submittedAt) { this.submittedAt = submittedAt; }
    public LocalDate getEarliestAssignmentDate() { return earliestAssignmentDate; }
    public void setEarliestAssignmentDate(LocalDate earliestAssignmentDate) { this.earliestAssignmentDate = earliestAssignmentDate; }
    public List<ProjectRowDTO> getProjectRows() { return projectRows; }
    public void setProjectRows(List<ProjectRowDTO> projectRows) { this.projectRows = projectRows; }
    public List<TimeOffRowDTO> getTimeOffRows() { return timeOffRows; }
    public void setTimeOffRows(List<TimeOffRowDTO> timeOffRows) { this.timeOffRows = timeOffRows; }
    public Double getTotalBillableHours() { return totalBillableHours; }
    public void setTotalBillableHours(Double totalBillableHours) { this.totalBillableHours = totalBillableHours; }
    public Double getTotalNonBillableHours() { return totalNonBillableHours; }
    public void setTotalNonBillableHours(Double totalNonBillableHours) { this.totalNonBillableHours = totalNonBillableHours; }
    public Double getTotalTimeOffHours() { return totalTimeOffHours; }
    public void setTotalTimeOffHours(Double totalTimeOffHours) { this.totalTimeOffHours = totalTimeOffHours; }
    public Double getGrandTotal() { return grandTotal; }
    public void setGrandTotal(Double grandTotal) { this.grandTotal = grandTotal; }
}
