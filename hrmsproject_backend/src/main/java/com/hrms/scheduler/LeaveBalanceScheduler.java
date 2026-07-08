package com.hrms.scheduler;

import com.hrms.model.LeaveBalance;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.service.LeaveBalanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Component
public class LeaveBalanceScheduler {

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    /**
     * Daily refresh — re-stamps totals against the policy and probation status.
     * Also catches up any balance whose currentYear is behind the calendar year
     * (e.g. a row that missed the Jan 1 job because the server was down).
     */
    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void refreshAllLeaveBalances() {
        int thisYear = LocalDate.now().getYear();
        List<LeaveBalance> all = leaveBalanceRepository.findAll();
        for (LeaveBalance balance : all) {
            try {
                if (balance.getCurrentYear() != null && balance.getCurrentYear() < thisYear) {
                    // A new cycle has started since the last time this row was touched —
                    // run the carry-forward roll-over before normal refresh.
                    leaveBalanceService.rolloverForNewYear(balance);
                } else {
                    leaveBalanceService.refreshLeaveBalance(balance);
                }
            } catch (Exception e) {
                System.err.println("Failed to refresh leave balance for employee ID: " +
                    (balance.getEmployee() != null ? balance.getEmployee().getId() : "unknown") +
                    ". Error: " + e.getMessage());
            }
        }
    }

    /**
     * Year-end carry-forward job.
     * Fires on Jan 1 at 00:05 local time (after the daily refresh window).
     * For every employee:
     *   - Casual + Earned: roll unused balance into carriedForward (capped at one cycle).
     *   - All other types: reset used counters; totals are re-stamped to annual entitlement.
     */
    @Scheduled(cron = "0 5 0 1 1 *")
    @Transactional
    public void runYearEndRollover() {
        List<LeaveBalance> all = leaveBalanceRepository.findAll();
        for (LeaveBalance balance : all) {
            try {
                leaveBalanceService.rolloverForNewYear(balance);
            } catch (Exception e) {
                System.err.println("Failed year-end rollover for employee ID: " +
                    (balance.getEmployee() != null ? balance.getEmployee().getId() : "unknown") +
                    ". Error: " + e.getMessage());
            }
        }
    }
}
