package com.hrms.service;

import com.hrms.dto.EmployeeSimpleDTO;
import com.hrms.dto.ManagerDetailsDTO;
import com.hrms.dto.ManagerSummaryDTO;
import com.hrms.dto.EmployeeReportingRequest;
import com.hrms.model.Employee;
import com.hrms.model.EmployeeReporting;
import com.hrms.model.User;
import com.hrms.model.Role;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.hrms.dto.EmployeeReportingDTO;
import com.hrms.model.CompanyDetail;

@Service
@RequiredArgsConstructor
public class EmployeeReportingService {

    private final EmployeeReportingRepository repository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final CompanyDetailRepository companyDetailRepository;
    private final TimesheetService timesheetService;
    private final LeaveService leaveService;

    public List<ManagerSummaryDTO> listManagers() {
        // List<Employee> managers = repository.findDistinctReportingManagers();
        List<Employee> managers = employeeRepository.findByUser_Role(Role.REPORTING_MANAGER);
        Map<Long, String> corporateEmailMap = companyDetailRepository.findAll().stream()
                .filter(cd -> cd.getOryfolksMailId() != null)
                .collect(Collectors.toMap(cd -> cd.getEmployee().getId(), CompanyDetail::getOryfolksMailId,
                        (a, b) -> a));

        return managers.stream()
                .map(m -> new ManagerSummaryDTO(m.getId(),
                        m.getFirstName() + " " + (m.getLastName() == null ? "" : m.getLastName()),
                        m.getEmail(),
                        corporateEmailMap.get(m.getId()),
                        m.getActive()))
                .collect(Collectors.toList());
    }

    public Employee promoteToManager(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee != null && employee.getUser() != null) {
            User u = employee.getUser();
            if (u.getRole() != Role.REPORTING_MANAGER) {
                u.setRole(Role.REPORTING_MANAGER);
                userRepository.save(u);

                // NEW: Assign this new manager to report to ADMIN
                ensureManagerReportsToAdmin(employee);
            }
            return employee;
        }
        return null;
    }

    public Employee promoteToHR(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee != null && employee.getUser() != null) {
            User u = employee.getUser();
            if (u.getRole() != Role.HR) {
                u.setRole(Role.HR);
                userRepository.save(u);

                // Ensure this new HR reports to Admin (similar to manager)
                ensureHRReportsToAdmin(employee);
            }
            return employee;
        }
        return null;
    }

    public List<EmployeeReportingDTO> listAllAssignments() {
        List<EmployeeReporting> items = repository.findAll();
        return items.stream().map(er -> {
            Long empId = er.getEmployee() != null ? er.getEmployee().getId() : null;
            Long mgrId = er.getReportingManager() != null ? er.getReportingManager().getId() : null;
            String mgrName = er.getReportingManager() != null ? (er.getReportingManager().getFirstName() + " "
                    + (er.getReportingManager().getLastName() == null ? "" : er.getReportingManager().getLastName()))
                    : null;
            String mgrEmail = er.getReportingManager() != null ? er.getReportingManager().getEmail() : null;
            String mgrRole = null;
            if (er.getReportingManager() != null && er.getReportingManager().getUser() != null) {
                mgrRole = er.getReportingManager().getUser().getRole() != null
                        ? er.getReportingManager().getUser().getRole().name()
                        : null;
            }
            Long hrId = er.getHr() != null ? er.getHr().getId() : null;
            String hrName = er.getHr() != null
                    ? (er.getHr().getFirstName() + " "
                            + (er.getHr().getLastName() == null ? "" : er.getHr().getLastName()))
                    : null;
            String hrRole = null;
            if (er.getHr() != null && er.getHr().getUser() != null) {
                hrRole = er.getHr().getUser().getRole() != null ? er.getHr().getUser().getRole().name() : null;
            }

            String mgrCorpEmail = er.getReportingManager() != null
                    ? companyDetailRepository.findByEmployee_Id(er.getReportingManager().getId())
                            .map(CompanyDetail::getOryfolksMailId).orElse(null)
                    : null;

            EmployeeReportingDTO dto = new EmployeeReportingDTO(empId, mgrId, mgrName, mgrEmail, mgrCorpEmail, hrId,
                    hrName);
            dto.setReportingManagerRole(mgrRole);
            dto.setHrRole(hrRole);
            return dto;
        }).collect(Collectors.toList());
    }

    /**
     * Builds the "HR Team & Assigned Employees" view for the Admin Dashboard: every HR
     * user with the list of employees assigned to them (via EmployeeReporting.hr). Mirrors
     * the Reporting Manager team data, but keyed on the HR relationship. Read-only — does
     * not alter any assignment or approval state.
     */
    public List<Map<String, Object>> listHrTeams() {
        List<Employee> hrEmployees = employeeRepository.findByUser_Role(Role.HR);
        List<Map<String, Object>> result = new java.util.ArrayList<>();

        for (Employee hr : hrEmployees) {
            CompanyDetail hrCd = companyDetailRepository.findByEmployee_Id(hr.getId()).orElse(null);

            Map<String, Object> hrMap = new java.util.LinkedHashMap<>();
            hrMap.put("hrEmployeeId", hr.getId()); // internal id (stable key for the UI)
            hrMap.put("hrId", hrCd != null && hrCd.getOryfolksId() != null ? hrCd.getOryfolksId()
                    : String.valueOf(hr.getId()));
            hrMap.put("hrName", (hr.getFirstName() + " " + (hr.getLastName() == null ? "" : hr.getLastName())).trim());
            hrMap.put("designation", hrCd != null && hrCd.getDesignation() != null ? hrCd.getDesignation() : "HR");
            hrMap.put("status", Boolean.FALSE.equals(hr.getActive()) ? "INACTIVE" : "ACTIVE");

            List<Map<String, Object>> assignedEmployees = new java.util.ArrayList<>();
            for (EmployeeReporting er : repository.findByHr(hr)) {
                Employee e = er.getEmployee();
                if (e == null)
                    continue;
                CompanyDetail cd = companyDetailRepository.findByEmployee_Id(e.getId()).orElse(null);
                Map<String, Object> empMap = new java.util.LinkedHashMap<>();
                empMap.put("employeeId", cd != null && cd.getOryfolksId() != null ? cd.getOryfolksId()
                        : String.valueOf(e.getId()));
                empMap.put("employeeName",
                        (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim());
                empMap.put("designation", cd != null && cd.getDesignation() != null ? cd.getDesignation() : "Employee");
                empMap.put("status", Boolean.FALSE.equals(e.getActive()) ? "INACTIVE" : "ACTIVE");
                assignedEmployees.add(empMap);
            }

            hrMap.put("assignedEmployees", assignedEmployees);
            hrMap.put("totalAssigned", assignedEmployees.size());
            result.add(hrMap);
        }

        return result;
    }

    public ManagerDetailsDTO getManagerDetails(Long managerId) {
        List<EmployeeReporting> items = repository.findAllByReportingManager_Id(managerId);
        if (items == null)
            items = java.util.Collections.emptyList();

        // Find manager employee object
        Employee manager = employeeRepository.findById(managerId).orElse(null);

        // Collect all IDs (manager + team) to fetch corporate emails in bulk
        java.util.Set<Long> allIds = new java.util.HashSet<>();
        if (managerId != null)
            allIds.add(managerId);
        for (EmployeeReporting er : items) {
            if (er.getEmployee() != null)
                allIds.add(er.getEmployee().getId());
        }

        // Fetch all relevant company details in one go
        Map<Long, String> corpEmailMap = companyDetailRepository.findByEmployee_IdIn(allIds).stream()
                .filter(cd -> cd.getEmployee() != null)
                .collect(Collectors.toMap(cd -> cd.getEmployee().getId(), CompanyDetail::getOryfolksMailId,
                        (a, b) -> a));

        List<EmployeeSimpleDTO> teamWithCorp = items.stream()
                .map(er -> er.getEmployee())
                .filter(e -> e != null)
                .map(e -> {
                    String corpEmail = corpEmailMap.get(e.getId());
                    return new EmployeeSimpleDTO(e.getId(),
                            e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName()),
                            e.getEmail(),
                            corpEmail,
                            e.getActive());
                })
                .collect(Collectors.toList());

        String fullName = manager != null
                ? (manager.getFirstName() + " " + (manager.getLastName() == null ? "" : manager.getLastName()))
                : "";
        String email = manager != null ? manager.getEmail() : "";
        String corporateEmail = corpEmailMap.get(managerId);

        return new ManagerDetailsDTO(managerId, fullName, email, corporateEmail, teamWithCorp);
    }

    public List<EmployeeSimpleDTO> getAvailableEmployees() {
        List<Employee> employees = employeeRepository.findByUser_Role(Role.EMPLOYEE);
        return employees.stream()
                .filter(e -> e.getUser() != null && e.getUser().getRole() == Role.EMPLOYEE) // Double check it's only
                                                                                            // employees
                .map(e -> {
                    String corpEmail = companyDetailRepository.findByEmployee_Id(e.getId())
                            .map(CompanyDetail::getOryfolksMailId).orElse(null);
                    return new EmployeeSimpleDTO(e.getId(),
                            e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName()),
                            e.getEmail(),
                            corpEmail,
                            e.getActive());
                })
                .collect(Collectors.toList());
    }

    public EmployeeReporting createOrUpdate(EmployeeReportingRequest req) {
        if (req == null || req.getEmployeeId() == null)
            return null;

        Employee employee = employeeRepository.findById(req.getEmployeeId()).orElse(null);
        if (employee == null)
            return null;

        EmployeeReporting er = repository.findByEmployee(employee).orElse(null);
        if (er == null)
            er = new EmployeeReporting();

        er.setEmployee(employee);

        if (req.getReportingManagerId() != null) {
            Employee mgr = employeeRepository.findById(req.getReportingManagerId()).orElse(null);
            er.setReportingManager(mgr);
            // promote manager's user role to REPORTING_MANAGER if currently EMPLOYEE
            if (mgr != null && mgr.getUser() != null) {
                User u = mgr.getUser();
                if (u.getRole() == Role.EMPLOYEE) {
                    u.setRole(Role.REPORTING_MANAGER);
                    userRepository.save(u);
                    // Ensure this new manager reports to Admin
                    ensureManagerReportsToAdmin(mgr);
                }
            }
        } else {
            er.setReportingManager(null);
        }

        if (req.getHrId() != null) {
            Employee hr = employeeRepository.findById(req.getHrId()).orElse(null);
            er.setHr(hr);
            // promote HR's user role to HR if currently EMPLOYEE
            if (hr != null && hr.getUser() != null) {
                User u = hr.getUser();
                if (u.getRole() == Role.EMPLOYEE) {
                    u.setRole(Role.HR);
                    userRepository.save(u);
                    // Ensure this new HR reports to Admin
                    ensureHRReportsToAdmin(hr);
                }
            }
        } else {
            er.setHr(null);
        }

        EmployeeReporting saved = repository.save(er);
        // An approver (RM and/or HR) was (re)assigned — hand this employee's Admin-pending
        // timesheets/leaves to the RM/HR flow and notify the new approvers.
        timesheetService.rerouteAdminPendingForEmployee(employee.getId());
        leaveService.transferAdminPendingForEmployee(employee.getId());
        return saved;
    }

    /**
     * Assigns (or re-assigns) an employee to an HR user, touching ONLY the hr field of
     * the employee's reporting record. The reporting manager and all other reporting
     * state are intentionally left untouched, so the existing approval hierarchy is
     * preserved. Pass hrId = null to unassign the employee from their HR.
     */
    @org.springframework.transaction.annotation.Transactional
    public EmployeeReporting assignEmployeeToHr(Long employeeId, Long hrId) {
        if (employeeId == null)
            return null;

        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee == null)
            return null;

        EmployeeReporting er = repository.findByEmployee(employee).orElse(null);
        if (er == null) {
            er = new EmployeeReporting();
            er.setEmployee(employee);
        }

        if (hrId != null) {
            Employee hr = employeeRepository.findById(hrId).orElse(null);
            er.setHr(hr);
        } else {
            er.setHr(null);
        }

        EmployeeReporting saved = repository.save(er);
        // HR was (re)assigned — hand this employee's Admin-pending timesheets/leaves to the
        // RM/HR flow (and notify the new approvers).
        timesheetService.rerouteAdminPendingForEmployee(employee.getId());
        leaveService.transferAdminPendingForEmployee(employee.getId());
        return saved;
    }

    @org.springframework.transaction.annotation.Transactional
    public void removeManager(Long managerId) {
        System.out.println("Attempting to remove manager with ID: " + managerId);

        // Use explicit fresh fetch
        Employee manager = employeeRepository.findById(managerId)
                .orElseThrow(() -> new RuntimeException("Manager not found"));

        // 1. Demote User Role
        if (manager.getUser() != null) {
            // Fetch User explicitly to ensure it is attached
            User u = userRepository.findById(manager.getUser().getId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            System.out.println("Found user: " + u.getId() + ", Current Role: " + u.getRole());

            if (u.getRole() == Role.REPORTING_MANAGER) {
                u.setRole(Role.EMPLOYEE);
                userRepository.saveAndFlush(u); // Flush to force DB update
                System.out.println("Demoted user to EMPLOYEE");
            }
        }

        // NEW: Revert to previous reporting manager
        EmployeeReporting employeeReporting = repository.findByEmployee(manager).orElse(null);
        if (employeeReporting != null) {
            if (employeeReporting.getPreviousReportingManager() != null) {
                employeeReporting.setReportingManager(employeeReporting.getPreviousReportingManager());
                employeeReporting.setPreviousReportingManager(null); // Clear history
                System.out.println("Reverted to previous manager: " + employeeReporting.getReportingManager().getId());
            } else {
                employeeReporting.setReportingManager(null); // No previous manager, set to null
                System.out.println("No previous manager, cleared reporting manager");
            }
            repository.save(employeeReporting);
        }

        // 2. Unassign all team members
        List<EmployeeReporting> team = repository.findAllByReportingManager_Id(managerId);
        System.out.println("Found " + team.size() + " team members");

        for (EmployeeReporting teamMemberEr : team) {
            teamMemberEr.setReportingManager(null);
            repository.save(teamMemberEr);
        }
        repository.flush(); // Flush updates
        System.out.println("Unassigned team members");
    }

    @org.springframework.transaction.annotation.Transactional
    public void removeTeamMember(Long employeeId) {
        System.out.println("Attempting to unassign team member with ID: " + employeeId);
        EmployeeReporting er = repository.findByEmployee_Id(employeeId).orElse(null);
        if (er != null) {
            er.setReportingManager(null);
            repository.save(er);
            repository.flush();
            System.out.println("Unassigned employee " + employeeId);
        } else {
            System.out.println("EmployeeReporting record not found for employee " + employeeId);
        }
    }

    private void ensureManagerReportsToAdmin(Employee manager) {
        if (manager == null)
            return;

        List<User> admins = userRepository.findByRole(Role.ADMIN);
        if (!admins.isEmpty()) {
            User adminUser = admins.get(0);
            Employee adminEmployee = employeeRepository.findByUser(adminUser).orElse(null);

            if (adminEmployee != null) {
                // Get or Create EmployeeReporting record for this manager
                EmployeeReporting er = repository.findByEmployee(manager).orElse(new EmployeeReporting());
                er.setEmployee(manager);

                // Check if already reporting to Admin to avoid redundant updates/history spam
                if (er.getReportingManager() != null
                        && er.getReportingManager().getId().equals(adminEmployee.getId())) {
                    return;
                }

                // Save current manager as previous
                if (er.getReportingManager() != null) {
                    er.setPreviousReportingManager(er.getReportingManager());
                }

                // Set new manager to Admin
                er.setReportingManager(adminEmployee);
                repository.save(er);
                System.out.println("Assigned manager " + manager.getId() + " to report to Admin.");
            }
        }
    }

    private void ensureHRReportsToAdmin(Employee hr) {
        if (hr == null)
            return;

        List<User> admins = userRepository.findByRole(Role.ADMIN);
        if (!admins.isEmpty()) {
            User adminUser = admins.get(0);
            Employee adminEmployee = employeeRepository.findByUser(adminUser).orElse(null);

            if (adminEmployee != null) {
                EmployeeReporting er = repository.findByEmployee(hr).orElse(new EmployeeReporting());
                er.setEmployee(hr);

                if (er.getReportingManager() != null
                        && er.getReportingManager().getId().equals(adminEmployee.getId())) {
                    return;
                }

                if (er.getReportingManager() != null) {
                    er.setPreviousReportingManager(er.getReportingManager());
                }

                er.setReportingManager(adminEmployee);
                repository.save(er);
                System.out.println("Assigned HR " + hr.getId() + " to report to Admin.");
            }
        }
    }
}
