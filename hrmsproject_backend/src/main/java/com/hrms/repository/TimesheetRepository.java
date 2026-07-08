package com.hrms.repository;

import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.List;

@Repository
public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {
        List<Timesheet> findByEmployeeId(Long employeeId);

        List<Timesheet> findByStatus(TimesheetStatus status);

        // Timesheets for one employee in a specific approval stage. Used to re-route items
        // waiting with Admin (PENDING_ADMIN_APPROVAL) back into the RM/HR flow once an
        // approver is assigned to that employee.
        List<Timesheet> findByEmployeeIdAndStatus(Long employeeId, TimesheetStatus status);

        // Count timesheets for an employee whose status is in the given set.
        // Used to block disabling/deleting an employee with pending approvals.
        long countByEmployeeIdAndStatusIn(Long employeeId, java.util.Collection<TimesheetStatus> statuses);

        List<Timesheet> findByEmployeeIdAndDateBetween(Long employeeId, LocalDate startDate, LocalDate endDate);

        List<Timesheet> findByDateBetween(LocalDate startDate, LocalDate endDate);

        @Query("SELECT DISTINCT t FROM Timesheet t JOIN FETCH t.employee e LEFT JOIN FETCH e.user WHERE " +
                        "(:employeeId IS NULL OR t.employee.id = :employeeId) AND " +
                        "(:excludeUserId IS NULL OR t.employee.user.id <> :excludeUserId) AND " +
                        "(:fromDate IS NULL OR t.date >= :fromDate) AND " +
                        "(:toDate IS NULL OR t.date <= :toDate) AND " +
                        "(:status IS NULL OR t.status = :status)")
        List<Timesheet> findWithFilters(@Param("employeeId") Long employeeId,
                        @Param("excludeUserId") Long excludeUserId,
                        @Param("fromDate") LocalDate fromDate,
                        @Param("toDate") LocalDate toDate,
                        @Param("status") TimesheetStatus status);

        @Query("SELECT t FROM Timesheet t JOIN FETCH t.employee e LEFT JOIN FETCH e.user WHERE t.id = :id")
        Optional<Timesheet> findByIdWithEmployeeAndUser(@Param("id") Long id);

        @Query("SELECT t FROM Timesheet t WHERE t.employee.id = :employeeId AND t.date = :date AND t.status = 'APPROVED'")
        List<Timesheet> findApprovedByEmployeeAndDate(@Param("employeeId") Long employeeId,
                        @Param("date") LocalDate date);

        @Query("SELECT t FROM Timesheet t JOIN EmployeeReporting er ON t.employee.id = er.employee.id WHERE er.reportingManager.id = :managerId")
        List<Timesheet> findByManagerId(@Param("managerId") Long managerId);

        List<Timesheet> findByReviewedBy(com.hrms.model.User reviewedBy);

        @Modifying(flushAutomatically = true, clearAutomatically = true)
        @Query("DELETE FROM Timesheet t WHERE t.employee.id = :employeeId AND t.date BETWEEN :startDate AND :endDate")
        void deleteByEmployeeIdAndDateBetween(@Param("employeeId") Long employeeId, @Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
