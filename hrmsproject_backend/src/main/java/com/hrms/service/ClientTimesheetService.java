package com.hrms.service;

import com.hrms.dto.ClientTimesheetDTO;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Service for client timesheets. Reads and writes exclusively to the
 * client_timesheets table via {@link ClientTimesheetRepository}. It never touches
 * the internal timesheets table or its service.
 */
@Service
@Transactional
public class ClientTimesheetService {

    @Autowired
    private ClientTimesheetRepository clientTimesheetRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    public List<ClientTimesheetDTO> getAll(Long employeeId, String clientName, String status,
            LocalDate fromDate, LocalDate toDate) {
        ClientTimesheetStatus statusEnum = (status != null && !status.isBlank())
                ? ClientTimesheetStatus.valueOf(status.toUpperCase())
                : null;
        String client = (clientName != null && !clientName.isBlank()) ? clientName : null;

        return clientTimesheetRepository
                .findWithFilters(employeeId, client, statusEnum, fromDate, toDate)
                .stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public ClientTimesheetDTO getById(Long id) {
        ClientTimesheet entry = clientTimesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client timesheet not found"));
        return convertToDTO(entry);
    }

    public ClientTimesheetDTO create(ClientTimesheetDTO dto) {
        if (dto.getEmployeeId() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "employeeId is required");
        }
        Employee employee = employeeRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        ClientTimesheet entry = new ClientTimesheet();
        entry.setEmployee(employee);
        entry.setDate(dto.getDate());
        entry.setClientName(dto.getClientName());
        entry.setProjectName(dto.getProjectName());
        entry.setTask(dto.getTask());
        entry.setHours(dto.getHours());
        entry.setBillable(dto.getBillable());
        entry.setNotes(dto.getNotes());
        entry.setStatus(ClientTimesheetStatus.PENDING);
        entry.setSubmittedAt(LocalDateTime.now());

        ClientTimesheet saved = clientTimesheetRepository.save(entry);
        return convertToDTO(saved);
    }

    public ClientTimesheetDTO approve(Long id, Long reviewerId) {
        ClientTimesheet entry = clientTimesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client timesheet not found"));
        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        entry.setStatus(ClientTimesheetStatus.APPROVED);
        entry.setApprovedBy(reviewer);
        entry.setRejectionReason(null);
        entry.setReviewedAt(LocalDateTime.now());
        return convertToDTO(clientTimesheetRepository.save(entry));
    }

    public ClientTimesheetDTO reject(Long id, Long reviewerId, String reason) {
        ClientTimesheet entry = clientTimesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client timesheet not found"));
        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        entry.setStatus(ClientTimesheetStatus.REJECTED);
        entry.setApprovedBy(reviewer);
        entry.setRejectionReason(reason);
        entry.setReviewedAt(LocalDateTime.now());
        return convertToDTO(clientTimesheetRepository.save(entry));
    }

    private ClientTimesheetDTO convertToDTO(ClientTimesheet entry) {
        ClientTimesheetDTO dto = new ClientTimesheetDTO();
        dto.setId(entry.getId());
        Employee employee = entry.getEmployee();
        if (employee != null) {
            dto.setEmployeeId(employee.getId());
            String fullName = (employee.getFirstName() + " "
                    + (employee.getLastName() == null ? "" : employee.getLastName())).trim();
            dto.setEmployeeName(fullName);
        }
        dto.setDate(entry.getDate());
        dto.setClientName(entry.getClientName());
        dto.setProjectName(entry.getProjectName());
        dto.setTask(entry.getTask());
        dto.setHours(entry.getHours());
        dto.setBillable(entry.getBillable());
        dto.setCategory(entry.getCategory());
        dto.setWeekStartDate(entry.getWeekStartDate());
        dto.setWeekEndDate(entry.getWeekEndDate());
        dto.setNotes(entry.getNotes());
        dto.setStatus(entry.getStatus() != null ? entry.getStatus().name() : null);
        dto.setRejectionReason(entry.getRejectionReason());
        dto.setApprovedByName(resolveUserDisplayName(entry.getApprovedBy()));
        dto.setSubmittedAt(entry.getSubmittedAt() != null ? entry.getSubmittedAt().toString() : null);
        dto.setReviewedAt(entry.getReviewedAt() != null ? entry.getReviewedAt().toString() : null);
        return dto;
    }

    /**
     * Human-readable name for the approver: the linked Employee's full name, falling
     * back to the username. Mirrors the internal timesheet display convention.
     */
    private String resolveUserDisplayName(User user) {
        if (user == null) {
            return null;
        }
        return employeeRepository.findByUser(user)
                .map(e -> (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim())
                .filter(name -> !name.isEmpty())
                .orElse(user.getUsername());
    }
}
