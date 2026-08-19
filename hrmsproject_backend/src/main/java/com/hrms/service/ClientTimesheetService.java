package com.hrms.service;

import com.hrms.dto.ClientTimesheetDTO;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.CompanyDetailRepository;
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

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @Autowired
    private ClientTimesheetNotificationService notificationService;

    // Emails the employee when their week is rejected. Additive: the bell notification above
    // is unchanged and still fires on its own.
    @Autowired
    private ClientTimesheetEmailService clientTimesheetEmailService;

    @Autowired
    private UserDisplayNameResolver userDisplayNameResolver;

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

        if (dto.getDate() != null) {
            companyDetailRepository.findByEmployee_Id(dto.getEmployeeId()).ifPresent(detail -> {
                if (detail.getJoiningDate() != null && dto.getDate().isBefore(detail.getJoiningDate())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Timesheet entries cannot be created for dates before the employee's joining date.");
                }
            });
        }

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
        ClientTimesheetDTO result = convertToDTO(clientTimesheetRepository.save(entry));
        notificationService.notifyEmployeeTimesheetApproved(entry.getEmployee(), entry.getWeekStartDate());
        return result;
    }

    /**
     * Agreed limit for the admin's rejection reason. Enforced server-side because the
     * textarea's maxLength is bypassed by a direct API call, and the backing column is
     * VARCHAR(256) — an overrun would otherwise surface as a raw 500 from MySQL.
     * Mirrored in the frontend by utils/fieldLimits.js.
     */
    private static final int MAX_REJECTION_REASON = 256;

    public ClientTimesheetDTO reject(Long id, Long reviewerId, String reason) {
        if (reason != null && reason.length() > MAX_REJECTION_REASON) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Rejection Reason must be " + MAX_REJECTION_REASON
                            + " characters or fewer (currently " + reason.length() + ").");
        }
        ClientTimesheet entry = clientTimesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Client timesheet not found"));
        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        entry.setStatus(ClientTimesheetStatus.REJECTED);
        entry.setApprovedBy(reviewer);
        entry.setRejectionReason(reason);
        entry.setReviewedAt(LocalDateTime.now());
        ClientTimesheetDTO result = convertToDTO(clientTimesheetRepository.save(entry));
        notificationService.notifyEmployeeTimesheetRejected(entry.getEmployee(), entry.getWeekStartDate(), reason);
        // Email in addition to the bell above, never instead of it. Side effect only — the
        // rejection is already saved and the email service swallows its own failures, so an
        // unreachable mail server can never fail the admin's decision. Deduped inside for the
        // week, because rejecting a week posts one request per day row.
        clientTimesheetEmailService.sendRejectionNotice(entry);
        return result;
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
            // Null-safe: the column defaults to true, but older rows may predate it.
            dto.setEmployeeActive(!Boolean.FALSE.equals(employee.getActive()));
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
     * Human-readable name for the approver. Delegates to the shared resolver so the same
     * person is spelled identically here, on the week detail view and on an assignment.
     */
    private String resolveUserDisplayName(User user) {
        return userDisplayNameResolver.resolve(user);
    }
}
