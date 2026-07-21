package com.hrms.dto;

public class TimesheetDownloadRequest {
    private int recordCount;
    private String filters;
    private String timesheetType;

    public TimesheetDownloadRequest() {}

    public TimesheetDownloadRequest(int recordCount, String filters, String timesheetType) {
        this.recordCount = recordCount;
        this.filters = filters;
        this.timesheetType = timesheetType;
    }

    public int getRecordCount() {
        return recordCount;
    }

    public void setRecordCount(int recordCount) {
        this.recordCount = recordCount;
    }

    public String getFilters() {
        return filters;
    }

    public void setFilters(String filters) {
        this.filters = filters;
    }

    public String getTimesheetType() {
        return timesheetType;
    }

    public void setTimesheetType(String timesheetType) {
        this.timesheetType = timesheetType;
    }
}
