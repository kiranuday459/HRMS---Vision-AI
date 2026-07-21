package com.hrms.repository;

import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

/**
 * Repository for {@link ClientTimesheet}. Every query touches only client_timesheets —
 * nothing here references the timesheets table.
 */
@Repository
public interface ClientTimesheetRepository extends JpaRepository<ClientTimesheet, Long> {

    @Query("SELECT DISTINCT ct FROM ClientTimesheet ct JOIN FETCH ct.employee e LEFT JOIN FETCH ct.approvedBy WHERE " +
            "(:employeeId IS NULL OR ct.employee.id = :employeeId) AND " +
            "(:clientName IS NULL OR ct.clientName = :clientName) AND " +
            "(:status IS NULL OR ct.status = :status) AND " +
            "(:fromDate IS NULL OR ct.date >= :fromDate) AND " +
            "(:toDate IS NULL OR ct.date <= :toDate) " +
            "ORDER BY ct.date DESC, ct.id DESC")
    List<ClientTimesheet> findWithFilters(@Param("employeeId") Long employeeId,
            @Param("clientName") String clientName,
            @Param("status") ClientTimesheetStatus status,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate);

    // ---- Employee week-entry helpers (client_timesheets only) ----
    List<ClientTimesheet> findByEmployeeIdAndWeekStartDate(Long employeeId, LocalDate weekStartDate);

    List<ClientTimesheet> findByEmployeeIdOrderByDateDesc(Long employeeId);
}
