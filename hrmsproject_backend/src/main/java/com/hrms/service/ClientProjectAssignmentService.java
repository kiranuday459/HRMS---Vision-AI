package com.hrms.service;

import com.hrms.dto.ClientProjectAssignmentDTO;
import com.hrms.model.ClientProjectAssignment;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientProjectAssignmentRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Manages client/project assignments. Independent of the internal timesheets feature.
 */
@Service
@Transactional
public class ClientProjectAssignmentService {

    @Autowired
    private ClientProjectAssignmentRepository assignmentRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    /**
     * Creates one assignment per employee in the payload (the admin modal assigns one
     * client/project to a set of employees). Returns the created assignments.
     */
    public List<ClientProjectAssignmentDTO> create(ClientProjectAssignmentDTO dto, Long createdByUserId) {
        List<Long> employeeIds = new ArrayList<>();
        if (dto.getEmployeeIds() != null) {
            employeeIds.addAll(dto.getEmployeeIds());
        }
        if (dto.getEmployeeId() != null && !employeeIds.contains(dto.getEmployeeId())) {
            employeeIds.add(dto.getEmployeeId());
        }
        if (employeeIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one employee is required");
        }
        if (dto.getAssignmentStartDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assignmentStartDate is required");
        }

        User assignedBy = createdByUserId != null
                ? userRepository.findById(createdByUserId).orElse(null)
                : null;

        List<ClientProjectAssignmentDTO> created = new ArrayList<>();
        for (Long employeeId : employeeIds) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Employee not found: " + employeeId));

            ClientProjectAssignment a = new ClientProjectAssignment();
            a.setEmployee(employee);
            a.setClientName(dto.getClientName());
            a.setProjectId(dto.getProjectId());
            a.setProjectName(dto.getProjectName());
            a.setTaskId(dto.getTaskId());
            a.setTaskDescription(dto.getTaskDescription());
            a.setOnsiteOffshore(dto.getOnsiteOffshore() != null ? dto.getOnsiteOffshore() : "ONSITE");
            a.setClientBillable(dto.getClientBillable() != null ? dto.getClientBillable() : "BILLABLE");
            a.setBillingLocation(dto.getBillingLocation() != null ? dto.getBillingLocation() : "DFLT");
            a.setAssignmentStartDate(dto.getAssignmentStartDate());
            a.setActive(true);
            a.setAssignedBy(assignedBy);

            created.add(toDTO(assignmentRepository.save(a)));

            // Mirror the current (latest) assignment onto the employee record so the
            // project name can be appended after the employee's name across the app.
            employee.setClientProject(dto.getProjectName());
            employee.setClientProjectId(dto.getProjectId());
            employee.setClientAssignmentDate(dto.getAssignmentStartDate());
            employeeRepository.save(employee);
        }
        return created;
    }

    public List<ClientProjectAssignmentDTO> getActiveForEmployee(Long employeeId) {
        return assignmentRepository.findByEmployeeIdAndActiveTrue(employeeId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    public List<ClientProjectAssignmentDTO> getAll() {
        return assignmentRepository.findAll().stream().map(this::toDTO).collect(Collectors.toList());
    }

    /**
     * Earliest active assignment start date for an employee — the global gate for their
     * Client Timesheet summary. Null when the employee has no active assignment.
     */
    public LocalDate earliestAssignmentDate(Long employeeId) {
        return assignmentRepository.findByEmployeeIdAndActiveTrue(employeeId).stream()
                .map(ClientProjectAssignment::getAssignmentStartDate)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(null);
    }

    private ClientProjectAssignmentDTO toDTO(ClientProjectAssignment a) {
        ClientProjectAssignmentDTO dto = new ClientProjectAssignmentDTO();
        dto.setId(a.getId());
        if (a.getEmployee() != null) {
            dto.setEmployeeId(a.getEmployee().getId());
            String name = (a.getEmployee().getFirstName() + " "
                    + (a.getEmployee().getLastName() == null ? "" : a.getEmployee().getLastName())).trim();
            dto.setEmployeeName(name);
        }
        dto.setClientName(a.getClientName());
        dto.setProjectId(a.getProjectId());
        dto.setProjectName(a.getProjectName());
        dto.setTaskId(a.getTaskId());
        dto.setTaskDescription(a.getTaskDescription());
        dto.setOnsiteOffshore(a.getOnsiteOffshore());
        dto.setClientBillable(a.getClientBillable());
        dto.setBillingLocation(a.getBillingLocation());
        dto.setAssignmentStartDate(a.getAssignmentStartDate());
        dto.setActive(a.getActive());
        return dto;
    }
}
