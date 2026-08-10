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

    /**
     * Lines this employee has sitting in a given status, optionally narrowed to one project.
     * Backing the "can this assignment be removed yet?" check — an assignment cannot be closed
     * out while one of its weeks is still awaiting an approve/reject decision.
     *
     * Status lives on the line rows rather than the week header: admin approve/reject acts per
     * row, so the rows are the authority on what is still undecided.
     *
     * Derived rather than a @Query on purpose. The distinct-weeks rollup these feed is a couple
     * of lines of Java, and a hand-written JPQL string is only validated when the application
     * context starts — a typo in one is an application that does not boot, which no amount of
     * mocked unit testing would catch. The row counts here are one employee's pending lines,
     * so there is nothing to gain by projecting in the database.
     */
    List<ClientTimesheet> findByEmployeeIdAndStatus(Long employeeId, ClientTimesheetStatus status);

    List<ClientTimesheet> findByEmployeeIdAndStatusAndProjectId(Long employeeId,
            ClientTimesheetStatus status, String projectId);
}
