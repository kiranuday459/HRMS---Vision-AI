package com.hrms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmployeeSimpleDTO {
    private Long id;
    private String name;
    private String email;
    private String corporateEmail;
    // Whether this employee's account is active. false => disabled (shown with a DISABLED badge).
    private Boolean active;
    // The HRMS-facing employee ID (company_details.oryfolks_id, e.g. "001") — what should be
    // shown as "Emp ID" in the UI, as opposed to the internal database primary key (id above).
    private String oryfolksId;
}
