package com.hrms.service;

import com.hrms.model.Employee;
import com.hrms.repository.CompanyDetailRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Payroll-facing employee id shown beside a name, e.g. OF-IT-PK-0416.
 *
 * Shared rather than reimplemented per service, for the same reason as
 * {@link UserDisplayNameResolver}: the Client Timesheet bell and the three Client Timesheet
 * emails all identify the same employee, and they must spell that id the same way.
 *
 * The id lives on company_details, not on the employee row. Falls back to the VisionAI id and
 * then to the row id, so an employee HR has not finished onboarding still identifies as
 * something the admin can look up.
 */
@Component
public class EmployeeCodeResolver {

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    public String resolve(Employee employee) {
        if (employee == null) {
            return "—";
        }
        return companyDetailRepository.findByEmployee_Id(employee.getId())
                .map(d -> {
                    if (d.getOryfolksId() != null && !d.getOryfolksId().isBlank()) return d.getOryfolksId();
                    if (d.getVisionaiId() != null && !d.getVisionaiId().isBlank()) return d.getVisionaiId();
                    return null;
                })
                .orElse("ID-" + employee.getId());
    }
}
