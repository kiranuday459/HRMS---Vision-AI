package com.hrms.dto;

import lombok.Data;

@Data
public class EmployeeReportingRequest {
    private Long employeeId;
    private Long reportingManagerId;
    private Long hrId;
}
