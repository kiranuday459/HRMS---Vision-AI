package com.hrms.service;

import com.hrms.model.CompanyDetail;
import com.hrms.model.Employee;
import com.hrms.model.Leave;
import com.hrms.model.LeaveBalance;
import com.hrms.model.LeaveStatus;
import com.hrms.model.LeaveType;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.repository.LeaveRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

/**
 * Leave policy enforced here:
 *   - Probation = first 6 months from joiningDate. No leaves are allocated.
 *     Any leave taken during this window is LOP.
 *   - Post probation, the annual entitlement is:
 *       Casual: 10, Sick: 10, Earned: 10, Maternity: 90, Paternity: 3, Bereavement: 2
 *   - Carry-forward:
 *       Casual + Earned: prior-year unused balance carries forward for ONE cycle only.
 *       Sick, Maternity, Paternity, Bereavement: reset every year (no carry-forward).
 */
@Service
@Transactional
public class LeaveBalanceService {

    // Annual entitlements.
    // ANNUAL_CASUAL = 10 covers the combined "Casual & Earned" pool. EARNED is no longer
    // a separate allocation; legacy EARNED submissions are coerced to CASUAL upstream.
    public static final double ANNUAL_CASUAL = 10.0;
    public static final double ANNUAL_SICK = 10.0;
    public static final double ANNUAL_EARNED = 0.0;
    public static final double ANNUAL_MATERNITY = 90.0;
    public static final double ANNUAL_PATERNITY = 3.0;
    public static final double ANNUAL_BEREAVEMENT = 2.0;

    public static final int PROBATION_MONTHS = 6;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @Autowired
    private LeaveRepository leaveRepository;

    public LeaveBalance initializeLeaveBalance(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if (leaveBalanceRepository.findByEmployeeId(employeeId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Leave balance already exists for this employee");
        }

        LeaveBalance balance = new LeaveBalance();
        balance.setEmployee(employee);
        balance.setCurrentYear(LocalDate.now().getYear());
        // All totals/used default to 0 from entity defaults

        LeaveBalance saved = leaveBalanceRepository.save(balance);
        return refreshLeaveBalance(saved);
    }

    /**
     * Brings totals in sync with policy based on probation status and current year.
     * - During probation: all totals are 0.
     * - Post probation: totals are filled with the annual entitlement constants.
     * Does NOT touch "used" counters here — those reflect actual leaves taken.
     * Carry-forward roll-over is handled separately by the year-end job.
     */
    public LeaveBalance refreshLeaveBalance(LeaveBalance balance) {
        if (balance == null || balance.getEmployee() == null) return balance;

        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(balance.getEmployee().getId())
                .orElse(null);

        if (detail == null || detail.getJoiningDate() == null) {
            return balance;
        }

        LocalDate today = LocalDate.now();
        LocalDate joiningDate = detail.getJoiningDate();
        LocalDate probationEnds = joiningDate.plusMonths(PROBATION_MONTHS);

        // Stamp the cycle year on first refresh so the year-end job can detect roll-over.
        if (balance.getCurrentYear() == null) {
            balance.setCurrentYear(today.getYear());
        }

        if (today.isBefore(probationEnds)) {
            // Probation: no allocation at all.
            balance.setCasualLeavesTotal(0.0);
            balance.setSickLeavesTotal(0.0);
            balance.setEarnedLeavesTotal(0.0);
            balance.setMaternityLeavesTotal(0.0);
            balance.setPaternityLeavesTotal(0.0);
            balance.setBereavementLeavesTotal(0.0);
            balance.setCasualLeavesCarriedForward(0.0);
            balance.setEarnedLeavesCarriedForward(0.0);
        } else {
            // Post probation: full annual entitlement for the current cycle.
            balance.setCasualLeavesTotal(ANNUAL_CASUAL);
            balance.setSickLeavesTotal(ANNUAL_SICK);
            balance.setEarnedLeavesTotal(ANNUAL_EARNED);
            balance.setMaternityLeavesTotal(ANNUAL_MATERNITY);
            balance.setPaternityLeavesTotal(ANNUAL_PATERNITY);
            balance.setBereavementLeavesTotal(ANNUAL_BEREAVEMENT);

            // --- Casual & Earned carry-forward (deterministic, self-backfilling) ---
            // Recompute the carry-forward from the joining date + actual leave history,
            // rather than relying on the year-end scheduler having fired for this row.
            // This way EXISTING employees who never had a Jan-1 roll-over run for them
            // still show the correct accumulated balance. For every COMPLETED leave year
            // since probation ended, unused Casual & Earned days roll into the next year,
            // capped so total accumulation never exceeds two years (10 current + at most
            // 10 carried = 20). Sick/Maternity/Paternity/Bereavement never carry.
            Long empId = balance.getEmployee().getId();
            Map<Integer, Double> casualUsedByYear = casualUsedByYear(empId);
            int currentYear = today.getYear();
            int firstLeaveYear = probationEnds.getYear();

            double carried = 0.0;
            for (int year = firstLeaveYear; year < currentYear; year++) {
                double available = ANNUAL_CASUAL + carried;
                double usedThatYear = casualUsedByYear.getOrDefault(year, 0.0);
                double unused = Math.max(0.0, available - usedThatYear);
                carried = Math.min(unused, ANNUAL_CASUAL); // cap → max 2-year accumulation
            }
            balance.setCasualLeavesCarriedForward(round2(carried));
            balance.setEarnedLeavesCarriedForward(0.0);

            // Current-year Casual & Earned usage, derived from history so the displayed
            // remaining (total + carried - used) is always consistent and self-correcting.
            balance.setCasualLeavesUsed(round2(casualUsedByYear.getOrDefault(currentYear, 0.0)));
        }

        return leaveBalanceRepository.save(balance);
    }

    /**
     * Sums Casual &amp; Earned leave days actually deducted (status != REJECTED), keyed by
     * the calendar year of the leave's start date. EARNED is part of the combined
     * Casual &amp; Earned pool; LOP and every other leave type are excluded.
     */
    private Map<Integer, Double> casualUsedByYear(Long employeeId) {
        Map<Integer, Double> map = new HashMap<>();
        for (Leave l : leaveRepository.findByEmployeeId(employeeId)) {
            if (l.getStatus() == LeaveStatus.REJECTED) continue;
            LeaveType t = l.getLeaveType();
            if (t != LeaveType.CASUAL && t != LeaveType.EARNED) continue;
            if (l.getStartDate() == null) continue;
            double days = l.getDaysCount() != null ? l.getDaysCount() : 0.0;
            map.merge(l.getStartDate().getYear(), days, Double::sum);
        }
        return map;
    }

    /**
     * Year-end roll-over. Should be invoked once per employee at the start of a new cycle.
     *   - Casual + Earned: unused balance from this cycle is carried forward to the next cycle.
     *     Previous carry-forward (if any) expires and is NOT rolled over again.
     *   - All other leave types: used counters reset to 0; totals are re-stamped on refresh.
     */
    public LeaveBalance rolloverForNewYear(LeaveBalance balance) {
        if (balance == null || balance.getEmployee() == null) return balance;

        int thisYear = LocalDate.now().getYear();

        // Idempotency guard: if this row has already been rolled into the current cycle,
        // do not carry forward again. The Jan-1 daily refresh (00:00) and the dedicated
        // year-end job (00:05) both invoke this method, so without the guard the same row
        // would be rolled over twice and the carry-forward inflated.
        if (balance.getCurrentYear() != null && balance.getCurrentYear() >= thisYear) {
            return refreshLeaveBalance(balance);
        }

        // Combined Casual & Earned carry-forward. The amount carried is the FULL unused
        // remaining of the closing cycle — this cycle's allocation PLUS any prior
        // carry-forward, minus what was used. (Any earned-leave column is treated as
        // already merged into casual upstream, so only the casual pool is carried.)
        double casualRemaining = Math.max(0.0,
                safe(balance.getCasualLeavesTotal())
                        + safe(balance.getCasualLeavesCarriedForward())
                        - safe(balance.getCasualLeavesUsed()));

        // Cap accumulation at a maximum of 2 years' worth: next cycle's available balance
        // is annual allocation + carry-forward, so the carry-forward itself is capped at
        // one annual allocation (10 + 10 = 20 = two years).
        double carryForward = Math.min(casualRemaining, ANNUAL_CASUAL);

        balance.setCasualLeavesCarriedForward(round2(carryForward));
        balance.setEarnedLeavesCarriedForward(0.0);

        // Reset used counters for the new cycle. Sick, Maternity, Paternity and
        // Bereavement carry nothing — their totals are re-stamped to the annual
        // entitlement by refreshLeaveBalance below, so they reset every year.
        balance.setCasualLeavesUsed(0.0);
        balance.setSickLeavesUsed(0.0);
        balance.setEarnedLeavesUsed(0.0);
        balance.setMaternityLeavesUsed(0.0);
        balance.setPaternityLeavesUsed(0.0);
        balance.setBereavementLeavesUsed(0.0);

        balance.setCurrentYear(thisYear);
        // Re-stamp totals against policy.
        LeaveBalance refreshed = refreshLeaveBalance(balance);
        return leaveBalanceRepository.save(refreshed);
    }

    public LeaveBalance getLeaveBalance(Long employeeId) {
        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employeeId)
                .orElseGet(() -> initializeLeaveBalance(employeeId));
        return refreshLeaveBalance(balance);
    }

    /**
     * Returns true if the employee is still inside their first 6 months from joining.
     */
    public boolean isOnProbation(Long employeeId) {
        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(employeeId).orElse(null);
        if (detail == null || detail.getJoiningDate() == null) return false;
        return LocalDate.now().isBefore(detail.getJoiningDate().plusMonths(PROBATION_MONTHS));
    }

    public LocalDate getProbationEndDate(Long employeeId) {
        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(employeeId).orElse(null);
        if (detail == null || detail.getJoiningDate() == null) return null;
        return detail.getJoiningDate().plusMonths(PROBATION_MONTHS);
    }

    public Double getRemainingLeaves(Long employeeId) {
        LeaveBalance b = getLeaveBalance(employeeId);
        return round2(b.getCasualLeavesRemaining()
                + b.getSickLeavesRemaining()
                + b.getEarnedLeavesRemaining()
                + b.getMaternityLeavesRemaining()
                + b.getPaternityLeavesRemaining()
                + b.getBereavementLeavesRemaining());
    }

    private static double safe(Double v) { return v != null ? v : 0.0; }
    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }
}
