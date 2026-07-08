package com.hrms.dto;

public class EmployeeReportingDTO {
    private Long employeeId;
    private Long reportingManagerId;
    private String reportingManagerName;
    private String reportingManagerEmail;
    private String reportingManagerCorporateEmail;
    private Long hrId;
    private String hrName;
    private String reportingManagerRole;
    private String hrRole;

    public EmployeeReportingDTO() {}

    public EmployeeReportingDTO(Long employeeId, Long reportingManagerId, String reportingManagerName, String reportingManagerEmail, String reportingManagerCorporateEmail, Long hrId, String hrName) {
        this.employeeId = employeeId;
        this.reportingManagerId = reportingManagerId;
        this.reportingManagerName = reportingManagerName;
        this.reportingManagerEmail = reportingManagerEmail;
        this.reportingManagerCorporateEmail = reportingManagerCorporateEmail;
        this.hrId = hrId;
        this.hrName = hrName;
    }

    public Long getEmployeeId() { return employeeId; }
    public void setEmployeeId(Long employeeId) { this.employeeId = employeeId; }

    public Long getReportingManagerId() { return reportingManagerId; }
    public void setReportingManagerId(Long reportingManagerId) { this.reportingManagerId = reportingManagerId; }

    public String getReportingManagerName() { return reportingManagerName; }
    public void setReportingManagerName(String reportingManagerName) { this.reportingManagerName = reportingManagerName; }

    public String getReportingManagerEmail() { return reportingManagerEmail; }
    public void setReportingManagerEmail(String reportingManagerEmail) { this.reportingManagerEmail = reportingManagerEmail; }

    public String getReportingManagerCorporateEmail() { return reportingManagerCorporateEmail; }
    public void setReportingManagerCorporateEmail(String reportingManagerCorporateEmail) { this.reportingManagerCorporateEmail = reportingManagerCorporateEmail; }

    public String getReportingManagerRole() { return reportingManagerRole; }
    public void setReportingManagerRole(String reportingManagerRole) { this.reportingManagerRole = reportingManagerRole; }

    public Long getHrId() { return hrId; }
    public void setHrId(Long hrId) { this.hrId = hrId; }

    public String getHrName() { return hrName; }
    public void setHrName(String hrName) { this.hrName = hrName; }
    public String getHrRole() { return hrRole; }
    public void setHrRole(String hrRole) { this.hrRole = hrRole; }
}
