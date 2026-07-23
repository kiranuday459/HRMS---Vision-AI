package com.hrms.service;

import com.hrms.dto.LeaveDTO;
import com.hrms.dto.CalendarAttendanceDTO;
import com.hrms.model.Employee;
import com.hrms.model.Leave;
import com.hrms.model.LeaveBalance;
import com.hrms.model.LeaveStatus;
import com.hrms.model.LeaveType;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.model.LeaveDayDetail;
import com.hrms.model.CompanyDetail;
import com.hrms.model.EmployeeReporting;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.repository.UserRepository;
import com.hrms.repository.LeaveDayDetailRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class LeaveService {

    @Autowired
    private LeaveRepository leaveRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private com.hrms.repository.CompanyDetailRepository companyDetailRepository;

    @Autowired
    private com.hrms.repository.EmployeeReportingRepository employeeReportingRepository;

    @Autowired
    private com.hrms.repository.HolidayRepository holidayRepository;

    @Autowired
    private LeaveDayDetailRepository leaveDayDetailRepository;

    @Autowired
    private NotificationService notificationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Fetch all leaves for team members of a manager
    public List<Leave> getTeamLeavesByManagerId(Long managerId) {
        List<com.hrms.model.EmployeeReporting> team = employeeReportingRepository
                .findAllByReportingManager_Id(managerId);
        List<Long> employeeIds = team.stream().map(er -> er.getEmployee().getId())
                .collect(java.util.stream.Collectors.toList());
        if (employeeIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        return leaveRepository.findByEmployeeIdIn(employeeIds);
    }

    public List<LeaveDTO> getAllLeaves() {
        return leaveRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    /**
     * HR routing filter: from a list of leaves, keep only those an HR user should see —
     * leaves of employees assigned to this HR (hrId == this HR), plus any employee not
     * yet assigned to ANY HR (fallback: unassigned employees stay visible to all HR
     * users, preserving existing behaviour). Does not alter the approval flow.
     *
     * Other HR users are never shown in the HR team queue, regardless of assignment or
     * the unassigned-employee fallback — an HR should only see their team (employees and
     * reporting managers), not fellow HR accounts (active or disabled) or their own record.
     */
    public List<LeaveDTO> filterForHr(List<LeaveDTO> all, Long hrEmployeeId) {
        if (all == null || hrEmployeeId == null)
            return all;

        java.util.Set<Long> assignedToThisHr = new java.util.HashSet<>();
        java.util.Set<Long> assignedToAnyHr = new java.util.HashSet<>();
        for (EmployeeReporting er : employeeReportingRepository.findAll()) {
            if (er.getHr() != null && er.getEmployee() != null) {
                assignedToAnyHr.add(er.getEmployee().getId());
                if (hrEmployeeId.equals(er.getHr().getId())) {
                    assignedToThisHr.add(er.getEmployee().getId());
                }
            }
        }

        // Employee ids of every HR account, so fellow HR users (and the logged-in HR
        // themselves) are excluded even when unassigned and reaching the fallback below.
        java.util.Set<Long> hrEmployeeIds = new java.util.HashSet<>();
        hrEmployeeIds.add(hrEmployeeId);
        for (User hr : userRepository.findByRole(com.hrms.model.Role.HR)) {
            employeeRepository.findByUser(hr).ifPresent(e -> hrEmployeeIds.add(e.getId()));
        }

        return all.stream()
                .filter(l -> l.getEmployeeId() != null
                        && !hrEmployeeIds.contains(l.getEmployeeId())
                        && (assignedToThisHr.contains(l.getEmployeeId())
                                || !assignedToAnyHr.contains(l.getEmployeeId())))
                .collect(Collectors.toList());
    }

    public LeaveDTO getLeaveById(Long id) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));
        return convertToDTO(leave);
    }

    public List<LeaveDTO> getLeavesByEmployeeId(Long employeeId) {
        return leaveRepository.findByEmployeeIdOrderBySubmittedAtDesc(employeeId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<LeaveDTO> getRecentLeavesByEmployeeId(Long employeeId, int limit) {
        return leaveRepository.findByEmployeeIdOrderBySubmittedAtDesc(employeeId).stream()
                .limit(limit)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public LeaveDTO createLeave(LeaveDTO dto) {
        Employee employee = employeeRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(employee.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company details not found"));

        if (detail.getJoiningDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee joining date is missing");
        }

        LocalDate now = LocalDate.now();
        LocalDate probationEnd = detail.getJoiningDate().plusMonths(6);
        boolean onProbation = now.isBefore(probationEnd);

        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave balance not found"));

        LeaveType leaveType = LeaveType.valueOf(dto.getLeaveType().toUpperCase());

        // 0. Casual & Earned are a single combined pool — any EARNED request is treated as CASUAL.
        if (leaveType == LeaveType.EARNED) {
            leaveType = LeaveType.CASUAL;
        }

        // 1. Probation rule: any leave taken in the first 6 months is LOP.
        //    If the user picked anything else, transparently coerce to LOP rather than reject —
        //    callers (UI) are expected to disable other options, but server is the source of truth.
        if (onProbation && leaveType != LeaveType.LOP) {
            leaveType = LeaveType.LOP;
        }

        double daysRequested = dto.getDaysCount() != null ? dto.getDaysCount() : 0.0;

        // 2. Balance check (LOP has no balance, so it always passes).
        if (!hassufficientBalance(balance, leaveType, daysRequested)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Insufficient " + leaveType.name() + " leave balance. Available: "
                + remainingFor(balance, leaveType) + ", Requested: " + daysRequested);
        }

        Leave leave = new Leave();
        leave.setEmployee(employee);
        leave.setStartDate(dto.getStartDate());
        leave.setEndDate(dto.getEndDate());
        leave.setLeaveType(leaveType);
        leave.setReason(dto.getReason());
        leave.setStatus(LeaveStatus.PENDING);
        leave.setDaysCount(daysRequested);

        // Disabled HR/RM rerouting (Part 4). Leaves stay single-stage normally; only when
        // HR is disabled and the RM stands in does the RM approve in two steps.
        applyInitialLeaveRouting(leave, employee);

        try {
            if (dto.getSessionData() != null) {
                leave.setSessionData(objectMapper.writeValueAsString(dto.getSessionData()));
            }
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process session data");
        }

        Leave saved = leaveRepository.save(leave);

        // Save daily breakdown to leave_details table
        if (dto.getSessionData() != null) {
            List<LeaveDayDetail> details = new ArrayList<>();
            dto.getSessionData().forEach((dateStr, session) -> {
                LeaveDayDetail dayDetail = new LeaveDayDetail();
                dayDetail.setLeave(saved);
                dayDetail.setLeaveDate(LocalDate.parse(dateStr));
                dayDetail.setDayType(session);
                details.add(dayDetail);
            });
            leaveDayDetailRepository.saveAll(details);
            saved.setDayDetails(details);
        }

        // Deduct balance immediately on submission
        updateLeaveBalance(saved, true);

        // Send Email Notifications
        sendLeaveEmails(saved);

        // Send In-App Notifications
        sendLeaveInAppNotifications(saved);

        return convertToDTO(saved);
    }

    private void sendLeaveInAppNotifications(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String leaveTypeName = leave.getLeaveType().name();
            String message = employeeName + " has submitted a " + leaveTypeName
                    + " leave request from " + leave.getStartDate() + " to " + leave.getEndDate()
                    + " (" + leave.getDaysCount() + " days).";

            System.out.println("[Notification] Sending leave notification for: " + employeeName);

            // Try to find reporting
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee)
                    .orElseGet(() -> employeeReportingRepository.findByEmployee_Id(employee.getId()).orElse(null));

            System.out.println("[Notification] EmployeeReporting found: " + (reporting != null));

            // Notify RM
            if (reporting != null && reporting.getReportingManager() != null) {
                Employee rm = reporting.getReportingManager();
                System.out.println("[Notification] RM: " + rm.getFirstName() + ", User: " + (rm.getUser() != null ? rm.getUser().getId() : "NULL"));
                if (rm.getUser() != null) {
                    notificationService.createNotification(
                        rm.getUser().getId(),
                        "New Leave Request",
                        message,
                        "LEAVE",
                        leave.getId()
                    );
                    System.out.println("[Notification] ✓ Notified RM userId=" + rm.getUser().getId());
                }
            } else {
                System.out.println("[Notification] ⚠ No reporting manager found for employee: " + employeeName);
            }

            // Notify HR
            List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
            System.out.println("[Notification] HR users count: " + hrUsers.size());
            for (User hr : hrUsers) {
                notificationService.createNotification(hr.getId(), "New Leave Request", message, "LEAVE", leave.getId());
                System.out.println("[Notification] ✓ Notified HR userId=" + hr.getId());
            }

            // Notify Admin
            List<User> adminUsers = userRepository.findByRole(com.hrms.model.Role.ADMIN);
            System.out.println("[Notification] Admin users count: " + adminUsers.size());
            for (User admin : adminUsers) {
                notificationService.createNotification(admin.getId(), "New Leave Request", message, "LEAVE", leave.getId());
                System.out.println("[Notification] ✓ Notified Admin userId=" + admin.getId());
            }
        } catch (Exception e) {
            System.err.println("[Notification] ✗ Failed to send leave in-app notifications: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendLeaveEmails(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            User user = employee.getUser();
            if (user == null)
                return;

            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String leaveType = leave.getLeaveType().name();
            String startDate = leave.getStartDate().toString();
            String endDate = leave.getEndDate().toString();
            String reason = leave.getReason();
            String role = user.getRole().name();

            List<String> to = new ArrayList<>();
            List<String> cc = new ArrayList<>();

            // 1. Employee's own corporate email (Add requester in TO)
            String employeeCorporateEmail = getCorporateEmail(employee);
            if (employeeCorporateEmail != null)
                to.add(employeeCorporateEmail);

            // Fetch reporting hierarchy
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee).orElse(null);

            if (user.getRole() == com.hrms.model.Role.EMPLOYEE) {
                // To: Manager, Self. CC: HR.
                if (reporting != null && reporting.getReportingManager() != null) {
                    String managerEmail = getCorporateEmail(reporting.getReportingManager());
                    if (managerEmail != null)
                        to.add(managerEmail);
                }

                // Always include HR in CC
                List<String> hrEmails = new ArrayList<>();
                if (reporting != null && reporting.getHr() != null) {
                    String hrEmail = getCorporateEmail(reporting.getHr());
                    if (hrEmail != null)
                        hrEmails.add(hrEmail);
                }

                if (hrEmails.isEmpty()) {
                    hrEmails = getHrEmails();
                }
                cc.addAll(hrEmails);

            } else if (user.getRole() == com.hrms.model.Role.REPORTING_MANAGER) {
                // To: HR, Self.
                List<String> hrEmails = new ArrayList<>();
                if (reporting != null && reporting.getHr() != null) {
                    String hrEmail = getCorporateEmail(reporting.getHr());
                    if (hrEmail != null)
                        hrEmails.add(hrEmail);
                }

                if (hrEmails.isEmpty()) {
                    hrEmails = getHrEmails();
                }
                to.addAll(hrEmails);
            } else if (user.getRole() == com.hrms.model.Role.HR) {
                // To: Admin, Self.
                List<User> admins = userRepository.findByRole(com.hrms.model.Role.ADMIN);
                for (User admin : admins) {
                    if (admin.getEmail() != null)
                        to.add(admin.getEmail());
                }
            }

            String[] toArr = to.stream().distinct().toArray(String[]::new);
            String[] ccArr = cc.stream().distinct().toArray(String[]::new);

            String breakdown = formatBreakdown(leave);
            
            LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employee.getId()).orElse(null);
            Double cBal = balance != null ? balance.getCasualLeavesRemaining() : 0.0;
            Double sBal = balance != null ? balance.getSickLeavesRemaining() : 0.0;
            Double eBal = balance != null ? balance.getEarnedLeavesRemaining() : 0.0;
            Double mBal = balance != null ? balance.getMaternityLeavesRemaining() : 0.0;
            Double pBal = balance != null ? balance.getPaternityLeavesRemaining() : 0.0;
            Double bBal = balance != null ? balance.getBereavementLeavesRemaining() : 0.0;

            if (toArr.length > 0) {
                emailService.sendLeaveRequestEmail(toArr, ccArr, employeeName, leaveType, startDate, endDate, leave.getDaysCount(), reason,
                        role, breakdown, cBal, sBal, eBal, mBal, pBal, bBal);
            }
        } catch (Exception e) {
            System.err.println("Failed to send leave request emails: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private List<String> getHrEmails() {
        List<String> hrEmails = new ArrayList<>();
        List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
        for (User u : hrUsers) {
            String email = null;
            var empOpt = employeeRepository.findByUser(u);
            if (empOpt.isPresent()) {
                email = getCorporateEmail(empOpt.get());
            }
            if (email == null || email.isEmpty()) {
                email = u.getEmail();
            }
            if (email != null && !email.isEmpty()) {
                hrEmails.add(email);
            }
        }
        return hrEmails;
    }

    private String getCorporateEmail(Employee employee) {
        return companyDetailRepository.findByEmployee_Id(employee.getId())
                .map(cd -> cd.getOryfolksMailId())
                .orElse(null);
    }

    public LeaveDTO approveLeave(Long id, Long approverId) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));

        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING leaves can be approved");
        }

        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approver not found"));

        // Two-stage HR-disabled path (Part 2/4): when the RM is standing in for a disabled HR
        // (route RM_HANDLES_ALL), the RM's FIRST approval only clears the RM stage — the leave
        // stays PENDING and comes back to the RM for the HR stage. The SECOND RM approval (or an
        // Admin override, or a re-enabled HR approving) finalizes it. Normal leaves are unchanged.
        boolean rmHandlesAll = "RM_HANDLES_ALL".equals(leave.getApprovalRoute());
        boolean approverIsRm = approver.getRole() == com.hrms.model.Role.REPORTING_MANAGER;
        boolean atRmStage = !"PENDING_RM_AS_HR_APPROVAL".equals(leave.getApprovalStage());

        if (rmHandlesAll && approverIsRm && atRmStage) {
            // First (RM-stage) approval — advance the sub-stage, keep PENDING, do not finalize.
            leave.setApprovalStage("PENDING_RM_AS_HR_APPROVAL");
            leave.setReviewedAt(LocalDateTime.now());
            Leave staged = leaveRepository.save(leave);
            if (staged.getEmployee().getUser() != null) {
                notificationService.createNotification(
                        approver.getId(),
                        "Leave — HR-stage approval needed",
                        nameOf(staged.getEmployee()) + "'s HR is disabled. Approve once more to complete the HR-stage approval.",
                        "LEAVE",
                        staged.getId());
            }
            return convertToDTO(staged);
        }

        leave.setStatus(LeaveStatus.APPROVED);
        leave.setApprovedBy(approver);
        leave.setReviewedAt(LocalDateTime.now());

        // Stamp the HR-stage stand-in when the RM finalized in place of a disabled HR.
        if (rmHandlesAll && approverIsRm) {
            String approverName = employeeRepository.findByUser(approver)
                    .map(this::nameOf)
                    .orElse(approver.getUsername());
            leave.setHrStageApprovedByName(approverName);
            leave.setHrStageApprovedByRole("REPORTING_MANAGER");
            leave.setHrStageApprovedAt(LocalDateTime.now());
            leave.setHrDisabledReroute(true);
        }

        Leave approved = leaveRepository.save(leave);

        // Send Status Email
        sendStatusEmail(approved);

        // Send In-App Notification
        if (approved.getEmployee().getUser() != null) {
            notificationService.createNotification(
                approved.getEmployee().getUser().getId(),
                "Leave Approved",
                "Your " + approved.getLeaveType() + " leave request has been approved.",
                "LEAVE",
                approved.getId()
            );
        }

        return convertToDTO(approved);
    }

    public LeaveDTO rejectLeave(Long id, Long approverId, String reason) {
        if (reason == null || reason.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rejection reason is required.");
        }

        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));

        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING leaves can be rejected");
        }

        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approver not found"));

        leave.setStatus(LeaveStatus.REJECTED);
        leave.setRejectionReason(reason);
        leave.setApprovedBy(approver);
        leave.setReviewedAt(LocalDateTime.now());

        Leave rejected = leaveRepository.save(leave);

        // Restore balance on rejection
        updateLeaveBalance(rejected, false);

        // Send Status Email
        sendStatusEmail(rejected);

        // Send In-App Notification
        if (rejected.getEmployee().getUser() != null) {
            notificationService.createNotification(
                rejected.getEmployee().getUser().getId(),
                "Leave Rejected",
                "Your " + rejected.getLeaveType() + " leave request has been rejected. Reason: " + reason,
                "LEAVE",
                rejected.getId()
            );
        }

        return convertToDTO(rejected);
    }

    private void sendStatusEmail(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            String employeeEmail = getCorporateEmail(employee);
            if (employeeEmail == null)
                return;

            String status = leave.getStatus().name();
            String reason = leave.getRejectionReason();
            String reviewerName = "Approver";

            if (leave.getApprovedBy() != null) {
                var reviewerEmp = employeeRepository.findByUser(leave.getApprovedBy());
                if (reviewerEmp.isPresent()) {
                    reviewerName = reviewerEmp.get().getFirstName() + " " + reviewerEmp.get().getLastName();
                }
            }

            List<String> to = new ArrayList<>();
            List<String> cc = new ArrayList<>();

            // To: Requesting Employee only (RM/HR are excluded from approval/rejection outcome emails)
            to.add(employeeEmail);

            String[] toArr = to.stream().distinct().toArray(String[]::new);
            String[] ccArr = cc.stream().distinct().toArray(String[]::new);

            String breakdown = formatBreakdown(leave);
            
            LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employee.getId()).orElse(null);
            Double cBal = balance != null ? balance.getCasualLeavesRemaining() : 0.0;
            Double sBal = balance != null ? balance.getSickLeavesRemaining() : 0.0;
            Double eBal = balance != null ? balance.getEarnedLeavesRemaining() : 0.0;
            Double mBal = balance != null ? balance.getMaternityLeavesRemaining() : 0.0;
            Double pBal = balance != null ? balance.getPaternityLeavesRemaining() : 0.0;
            Double bBal = balance != null ? balance.getBereavementLeavesRemaining() : 0.0;

            emailService.sendLeaveStatusEmail(
                    toArr,
                    ccArr,
                    employee.getFirstName() + " " + employee.getLastName(),
                    leave.getLeaveType().name(),
                    leave.getStartDate().toString(),
                    leave.getEndDate().toString(),
                    leave.getDaysCount(),
                    status,
                    reason,
                    reviewerName,
                    breakdown,
                    cBal, sBal, eBal, mBal, pBal, bBal);
        } catch (Exception e) {
            System.err.println("Failed to send leave status email: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private boolean hassufficientBalance(LeaveBalance balance, LeaveType leaveType, double daysRequested) {
        return switch (leaveType) {
            case CASUAL -> balance.getCasualLeavesRemaining() >= daysRequested;
            case SICK -> balance.getSickLeavesRemaining() >= daysRequested;
            case EARNED -> balance.getEarnedLeavesRemaining() >= daysRequested;
            case MATERNITY -> balance.getMaternityLeavesRemaining() >= daysRequested;
            case PATERNITY -> balance.getPaternityLeavesRemaining() >= daysRequested;
            case BEREAVEMENT -> balance.getBereavementLeavesRemaining() >= daysRequested;
            case LOP -> true; // LOP has no balance limit
        };
    }

    private double remainingFor(LeaveBalance balance, LeaveType leaveType) {
        return switch (leaveType) {
            case CASUAL -> balance.getCasualLeavesRemaining();
            case SICK -> balance.getSickLeavesRemaining();
            case EARNED -> balance.getEarnedLeavesRemaining();
            case MATERNITY -> balance.getMaternityLeavesRemaining();
            case PATERNITY -> balance.getPaternityLeavesRemaining();
            case BEREAVEMENT -> balance.getBereavementLeavesRemaining();
            case LOP -> 0.0;
        };
    }

    private double calculateLeaveDays(LocalDate startDate, LocalDate endDate, Boolean startHalf, Boolean endHalf) {
        if (startDate == null || endDate == null)
            return 0;
        
        // Fetch all holidays
        List<String> holidayDates = holidayRepository.findAll().stream()
                .map(com.hrms.model.Holiday::getHolidayDate)
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .collect(Collectors.toList());

        double totalDays = 0;
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            boolean isWeekend = date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                    || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY;
            
            String dateStr = date.toString();
            boolean isHoliday = holidayDates.contains(dateStr);
            
            if (isWeekend || isHoliday) {
                continue;
            }

            if (date.equals(startDate) && date.equals(endDate)) {
                // If both are checked for the same day, it's 0.5. If either is, it's 0.5.
                totalDays += (startHalf != null && startHalf) || (endHalf != null && endHalf) ? 0.5 : 1.0;
            } else if (date.equals(startDate) && startHalf != null && startHalf) {
                totalDays += 0.5;
            } else if (date.equals(endDate) && endHalf != null && endHalf) {
                totalDays += 0.5;
            } else {
                totalDays += 1.0;
            }
        }
        return totalDays;
    }

    private void updateLeaveBalance(Leave leave, boolean deduct) {
        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(leave.getEmployee().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave balance not found"));

        double days = leave.getDaysCount() != null ? leave.getDaysCount() : 0.0;
        double change = deduct ? days : -days;

        switch (leave.getLeaveType()) {
            case CASUAL:
                balance.setCasualLeavesUsed(Math.max(0.0, balance.getCasualLeavesUsed() + change));
                break;
            case SICK:
                balance.setSickLeavesUsed(Math.max(0.0, balance.getSickLeavesUsed() + change));
                break;
            case EARNED:
                balance.setEarnedLeavesUsed(Math.max(0.0, balance.getEarnedLeavesUsed() + change));
                break;
            case MATERNITY:
                balance.setMaternityLeavesUsed(Math.max(0.0, balance.getMaternityLeavesUsed() + change));
                break;
            case PATERNITY:
                balance.setPaternityLeavesUsed(Math.max(0.0, balance.getPaternityLeavesUsed() + change));
                break;
            case BEREAVEMENT:
                balance.setBereavementLeavesUsed(Math.max(0.0, balance.getBereavementLeavesUsed() + change));
                break;
            case LOP:
                // LOP doesn't affect standard leave balance
                break;
        }

        leaveBalanceRepository.save(balance);
    }

    public CalendarAttendanceDTO getCalendarAttendance(LocalDate start, LocalDate end) {
        System.out.println("CALENDAR_DEBUG: Fetching attendance from " + start + " to " + end);
        try {
            // Use repository to filter by status directly
            List<Leave> allApproved = leaveRepository.findByStatus(LeaveStatus.APPROVED);

            System.out.println("CALENDAR_DEBUG: Total approved leaves in DB: " + allApproved.size());

            // Filter by date range in memory
            List<Leave> approvedLeaves = allApproved.stream()
                    .filter(l -> l.getStartDate() != null && l.getEndDate() != null)
                    .filter(l -> !(l.getEndDate().isBefore(start) || l.getStartDate().isAfter(end)))
                    .collect(Collectors.toList());

            System.out.println("CALENDAR_DEBUG: Approved leaves in range: " + approvedLeaves.size());

            Map<String, List<String>> dailyLeaves = new HashMap<>();

            for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
                if (date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                        || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
                    continue;
                }

                final LocalDate current = date;
                List<String> names = approvedLeaves.stream()
                        .filter(l -> l.getEmployee() != null)
                        .filter(l -> !current.isBefore(l.getStartDate()) && !current.isAfter(l.getEndDate()))
                        .map(l -> l.getEmployee().getFirstName() + " " + l.getEmployee().getLastName())
                        .collect(Collectors.toList());

                if (!names.isEmpty()) {
                    dailyLeaves.put(current.toString(), names);
                }
            }

            return new CalendarAttendanceDTO(dailyLeaves);
        } catch (Exception e) {
            System.err.println("CALENDAR_ERROR: Failed to calculate attendance: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    private String formatBreakdown(Leave leave) {
        if (leave == null || leave.getStartDate() == null || leave.getEndDate() == null) return "";
        
        // Prefer database table values
        final Map<String, String> sessionData = new HashMap<>();
        if (leave.getDayDetails() != null && !leave.getDayDetails().isEmpty()) {
            leave.getDayDetails().forEach(d -> sessionData.put(d.getLeaveDate().toString(), d.getDayType()));
        } else if (leave.getSessionData() != null && !leave.getSessionData().isEmpty()) {
            try {
                sessionData.putAll(objectMapper.readValue(leave.getSessionData(), new TypeReference<Map<String, String>>() {}));
            } catch (Exception e) {
                System.err.println("Failed to parse session data: " + e.getMessage());
            }
        }

        List<String> holidayDates = holidayRepository.findAll().stream()
                .map(com.hrms.model.Holiday::getHolidayDate)
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        for (LocalDate date = leave.getStartDate(); !date.isAfter(leave.getEndDate()); date = date.plusDays(1)) {
            String dateStr = date.toString();
            sb.append(" - ").append(dateStr).append(": ");
            
            boolean isWeekend = date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                    || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY;
            boolean isHoliday = holidayDates.contains(dateStr);

            if (isHoliday) {
                sb.append("Public Holiday");
            } else if (isWeekend) {
                sb.append("Weekend");
            } else {
                String session = sessionData.get(dateStr);
                if (session != null) {
                    if (session.equalsIgnoreCase("FULL")) sb.append("Full Day");
                    else if (session.equalsIgnoreCase("MORNING")) sb.append("Morning (0.5)");
                    else if (session.equalsIgnoreCase("AFTERNOON")) sb.append("Afternoon (0.5)");
                    else sb.append(session);
                } else {
                    sb.append("—");
                }
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    /**
     * Derives where a leave is currently routed for approval from the employee's most
     * recent reporting assignment: "ADMIN" when neither an RM nor an HR is assigned
     * (fallback → Admin), otherwise "RM" (the normal RM/HR flow owns it).
     */
    private String resolveLeaveRoutedTo(Employee employee) {
        if (employee == null)
            return "ADMIN";
        return employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee)
                .map(er -> (er.getReportingManager() != null || er.getHr() != null) ? "RM" : "ADMIN")
                .orElse("ADMIN");
    }

    /**
     * Hands an employee's still-pending leaves from Admin to the newly assigned RM/HR flow.
     * Leaves are single-stage (PENDING) and any of RM/HR/Admin can approve, so no status
     * change is needed — routing is derived live from assignment. This only stamps the
     * transfer audit flag and notifies the RM/HR (Part 7). Called after an RM/HR assignment.
     *
     * @return the number of pending leaves handed over.
     */
    @Transactional
    public int transferAdminPendingForEmployee(Long employeeId) {
        if (employeeId == null)
            return 0;
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee == null)
            return 0;

        EmployeeReporting er = employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee).orElse(null);
        Employee rm = er != null ? er.getReportingManager() : null;
        Employee hr = er != null ? er.getHr() : null;
        if (rm == null && hr == null)
            return 0; // still no approvers — nothing to hand over

        List<Leave> pending = leaveRepository.findByEmployeeIdAndStatus(employeeId, LeaveStatus.PENDING);
        int transferred = 0;
        LocalDateTime now = LocalDateTime.now();
        for (Leave leave : pending) {
            if (!Boolean.TRUE.equals(leave.getTransferredFromAdmin())) {
                leave.setTransferredFromAdmin(true);
                leave.setTransferredAt(now);
                leaveRepository.save(leave);
                transferred++;
            }
        }

        // Part 7 — notify the RM/HR who can now action these leaves.
        if (transferred > 0) {
            String name = (employee.getFirstName() + " " + (employee.getLastName() == null ? "" : employee.getLastName())).trim();
            String message = "A leave request from " + name + " has been assigned to you for approval.";
            if (rm != null && rm.getUser() != null) {
                notificationService.createNotification(rm.getUser().getId(),
                        "Leave assigned for approval", message, "LEAVE", null);
            }
            if (hr != null && hr.getUser() != null) {
                notificationService.createNotification(hr.getUser().getId(),
                        "Leave assigned for approval", message, "LEAVE", null);
            }
        }
        return transferred;
    }

    // ---- Disabled HR/RM rerouting helpers (Part 4/7) ----

    private boolean isUsable(Employee e) {
        return e != null && !Boolean.FALSE.equals(e.getActive());
    }

    private String nameOf(Employee e) {
        if (e == null) return "";
        return (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim();
    }

    private void notifyEmployee(Employee e, String title, String message) {
        if (e != null && e.getUser() != null) {
            notificationService.createNotification(e.getUser().getId(), title, message, "LEAVE", null);
        }
    }

    /**
     * Sets the initial approval route for a newly submitted leave, honouring disabled-approver
     * rerouting. Only EMPLOYEE submissions are rerouted. Leaves stay PENDING (single-stage); the
     * RM_HANDLES_ALL route + approvalStage make the RM approve twice when HR is disabled. Flags
     * are stamped only for DISABLED approvers, so normal/unassigned flows are unchanged.
     */
    private void applyInitialLeaveRouting(Leave leave, Employee employee) {
        Role role = employee.getUser() != null ? employee.getUser().getRole() : Role.EMPLOYEE;
        if (role != Role.EMPLOYEE) return;

        EmployeeReporting er = employeeReportingRepository.findFirstByEmployeeOrderByIdDesc(employee).orElse(null);
        Employee rm = er != null ? er.getReportingManager() : null;
        Employee hr = er != null ? er.getHr() : null;
        boolean rmUsable = isUsable(rm);
        boolean hrUsable = isUsable(hr);
        boolean rmDisabled = rm != null && !rmUsable;
        boolean hrDisabled = hr != null && !hrUsable;

        if (rmUsable && hrDisabled) {
            // Case 3 — HR disabled: RM handles both stages (approve twice).
            leave.setApprovalRoute("RM_HANDLES_ALL");
            leave.setApprovalStage("PENDING_RM_APPROVAL");
            leave.setSkippedHR(true);
            leave.setSkippedHRReason("HR account is disabled");
            leave.setReroutedToRM(String.valueOf(rm.getId()));
            leave.setHrDisabledReroute(true);
        } else if (!rmUsable && hrUsable && rmDisabled) {
            // Case 2 — RM disabled: HR approves (single-stage, any approver already can).
            leave.setApprovalRoute("HR_DIRECT");
            leave.setSkippedRM(true);
            leave.setSkippedRMReason("RM account is disabled");
        } else if (!rmUsable && !hrUsable && (rmDisabled || hrDisabled)) {
            // Case 4/5 — both disabled: Admin.
            leave.setApprovalRoute("ADMIN_DIRECT");
            if (rmDisabled) { leave.setSkippedRM(true); leave.setSkippedRMReason("RM account is disabled"); }
            if (hrDisabled) { leave.setSkippedHR(true); leave.setSkippedHRReason("HR account is disabled"); }
        }
        // else: normal or pure-unassigned fallback → route left null (unchanged single-stage).
    }

    /**
     * Part 4/7 — an approver account was DISABLED. Reroute the still-PENDING leaves of every
     * employee this account is the RM or HR for.
     */
    @Transactional
    public void rerouteLeavesForDisabledApprover(Long disabledEmployeeId) {
        if (disabledEmployeeId == null) return;
        Employee disabled = employeeRepository.findById(disabledEmployeeId).orElse(null);
        if (disabled == null) return;

        // Employees whose HR is the now-disabled account.
        for (EmployeeReporting er : employeeReportingRepository.findByHr(disabled)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            Employee rm = er.getReportingManager();
            boolean rmUsable = isUsable(rm);
            for (Leave leave : leaveRepository.findByEmployeeIdAndStatus(emp.getId(), LeaveStatus.PENDING)) {
                if ("RM_HANDLES_ALL".equals(leave.getApprovalRoute())) continue; // already rerouted
                if (rmUsable) {
                    leave.setApprovalRoute("RM_HANDLES_ALL");
                    if (leave.getApprovalStage() == null) leave.setApprovalStage("PENDING_RM_APPROVAL");
                    leave.setSkippedHR(true);
                    leave.setSkippedHRReason("HR account is disabled");
                    leave.setReroutedToRM(String.valueOf(rm.getId()));
                    leave.setHrDisabledReroute(true);
                    leaveRepository.save(leave);
                    notifyEmployee(rm, "Leave needs your approval",
                            nameOf(emp) + "'s HR is disabled — you are now handling the HR approval.");
                } else {
                    leave.setApprovalRoute("ADMIN_DIRECT");
                    leave.setSkippedHR(true);
                    leave.setSkippedHRReason("HR account is disabled");
                    leaveRepository.save(leave);
                }
            }
        }

        // Employees whose Reporting Manager is the now-disabled account.
        for (EmployeeReporting er : employeeReportingRepository.findAllByReportingManager(disabled)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            Employee hr = er.getHr();
            boolean hrUsable = isUsable(hr);
            for (Leave leave : leaveRepository.findByEmployeeIdAndStatus(emp.getId(), LeaveStatus.PENDING)) {
                if (hrUsable && !"RM_HANDLES_ALL".equals(leave.getApprovalRoute())) {
                    leave.setApprovalRoute("HR_DIRECT");
                    leave.setSkippedRM(true);
                    leave.setSkippedRMReason("RM account is disabled");
                    leaveRepository.save(leave);
                    notifyEmployee(hr, "Leave needs your approval",
                            nameOf(emp) + "'s Reporting Manager is disabled — routed to you for approval.");
                } else if (!hrUsable) {
                    // RM (and possibly the stand-in RM) gone and no usable HR → Admin.
                    leave.setApprovalRoute("ADMIN_DIRECT");
                    leave.setApprovalStage(null);
                    leave.setSkippedRM(true);
                    leave.setSkippedRMReason("RM account is disabled");
                    leave.setHrDisabledReroute(false);
                    leaveRepository.save(leave);
                }
            }
        }
    }

    /**
     * Part 7 — an HR/RM account was RE-ENABLED. Transfer not-yet-finalized reroute leaves back
     * to that approver's own stage. Already-APPROVED/REJECTED leaves are untouched.
     */
    @Transactional
    public void transferLeavesBackToReenabledApprover(Long reenabledEmployeeId) {
        if (reenabledEmployeeId == null) return;
        Employee approver = employeeRepository.findById(reenabledEmployeeId).orElse(null);
        if (approver == null || !isUsable(approver)) return;

        // HR re-enabled → hand RM_HANDLES_ALL leaves back to HR as a normal single-stage PENDING.
        for (EmployeeReporting er : employeeReportingRepository.findByHr(approver)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            for (Leave leave : leaveRepository.findByEmployeeIdAndStatus(emp.getId(), LeaveStatus.PENDING)) {
                if ("RM_HANDLES_ALL".equals(leave.getApprovalRoute())) {
                    leave.setApprovalRoute("FULL_FLOW");
                    leave.setApprovalStage(null);
                    leave.setSkippedHR(false);
                    leave.setSkippedHRReason(null);
                    leave.setReroutedToRM(null);
                    leave.setHrDisabledReroute(false);
                    leaveRepository.save(leave);
                    notifyEmployee(approver, "Leave awaiting your approval",
                            nameOf(emp) + "'s leave has been returned to you for HR approval.");
                }
            }
        }

        // RM re-enabled → hand RM-skipped (HR_DIRECT) leaves back to the RM stage.
        for (EmployeeReporting er : employeeReportingRepository.findAllByReportingManager(approver)) {
            Employee emp = er.getEmployee();
            if (emp == null) continue;
            for (Leave leave : leaveRepository.findByEmployeeIdAndStatus(emp.getId(), LeaveStatus.PENDING)) {
                if (Boolean.TRUE.equals(leave.getSkippedRM()) && "HR_DIRECT".equals(leave.getApprovalRoute())) {
                    leave.setApprovalRoute("FULL_FLOW");
                    leave.setSkippedRM(false);
                    leave.setSkippedRMReason(null);
                    leaveRepository.save(leave);
                    notifyEmployee(approver, "Leave awaiting your approval",
                            nameOf(emp) + "'s leave has been returned to you for approval.");
                }
            }
        }
    }

    public LeaveDTO convertToDTO(Leave leave) {
        LeaveDTO dto = new LeaveDTO();
        dto.setId(leave.getId());
        dto.setEmployeeId(leave.getEmployee().getId());
        dto.setEmployeeName(leave.getEmployee().getFirstName() + " " + leave.getEmployee().getLastName());
        // Expose the employee's account status so disabled accounts can be flagged read-only
        // in Admin/HR/RM views. Records of disabled employees are still returned (no filtering).
        dto.setEmployeeStatus(
                Boolean.FALSE.equals(leave.getEmployee().getActive()) ? "INACTIVE" : "ACTIVE");
        dto.setStartDate(leave.getStartDate());
        dto.setEndDate(leave.getEndDate());
        dto.setLeaveType(leave.getLeaveType().name());
        dto.setReason(leave.getReason());
        dto.setStatus(leave.getStatus().name());
        // Routing is derived from the employee's CURRENT assignment: with no RM and no HR the
        // leave belongs to Admin ("ADMIN"); once an RM or HR is assigned it belongs to the
        // RM/HR flow ("RM"). Used by the Admin view to hide approve/reject once routed away.
        dto.setRoutedTo(resolveLeaveRoutedTo(leave.getEmployee()));
        dto.setTransferredFromAdmin(leave.getTransferredFromAdmin());
        // Disabled HR/RM rerouting — expose route/sub-stage/flags for the RM & employee views.
        dto.setApprovalStage(leave.getApprovalStage());
        dto.setApprovalRoute(leave.getApprovalRoute());
        dto.setSkippedRM(leave.getSkippedRM());
        dto.setSkippedHR(leave.getSkippedHR());
        dto.setReroutedToRM(leave.getReroutedToRM());
        dto.setHrDisabledReroute(leave.getHrDisabledReroute());
        dto.setHrStageApprovedByRole(leave.getHrStageApprovedByRole());
        dto.setRejectionReason(leave.getRejectionReason());
        dto.setSubmittedAt(leave.getSubmittedAt());
        if (leave.getApprovedBy() != null) {
            // Look up Employee by User to get full name
            String fullName = null;
            try {
                var empOpt = employeeRepository.findByUser(leave.getApprovedBy());
                if (empOpt.isPresent()) {
                    var emp = empOpt.get();
                    fullName = emp.getFirstName() + " " + emp.getLastName();
                }
            } catch (Exception ignored) {
            }
            dto.setApprovedBy(fullName != null ? fullName : leave.getApprovedBy().getUsername());
        }
        dto.setReviewedAt(leave.getReviewedAt());
        dto.setDaysCount(leave.getDaysCount());
        
        final Map<String, String> sessionMap = new HashMap<>();
        if (leave.getDayDetails() != null && !leave.getDayDetails().isEmpty()) {
            leave.getDayDetails().forEach(d -> sessionMap.put(d.getLeaveDate().toString(), d.getDayType()));
            dto.setSessionData(sessionMap);
        } else if (leave.getSessionData() != null) {
            try {
                sessionMap.putAll(objectMapper.readValue(leave.getSessionData(), new TypeReference<Map<String, String>>() {}));
                dto.setSessionData(sessionMap);
            } catch (JsonProcessingException ignored) {}
        }

        // Populate leave balance snapshot
        leaveBalanceRepository.findByEmployeeId(leave.getEmployee().getId()).ifPresent(balance -> {
            dto.setCasualLeavesRemaining(balance.getCasualLeavesRemaining());
            dto.setSickLeavesRemaining(balance.getSickLeavesRemaining());
            dto.setEarnedLeavesRemaining(balance.getEarnedLeavesRemaining());
            dto.setMaternityLeavesRemaining(balance.getMaternityLeavesRemaining());
            dto.setPaternityLeavesRemaining(balance.getPaternityLeavesRemaining());
            dto.setBereavementLeavesRemaining(balance.getBereavementLeavesRemaining());
            dto.setCasualLeavesCarriedForward(balance.getCasualLeavesCarriedForward());
            dto.setEarnedLeavesCarriedForward(balance.getEarnedLeavesCarriedForward());
        });

        return dto;
    }
}
