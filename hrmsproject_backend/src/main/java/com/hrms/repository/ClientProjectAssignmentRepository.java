package com.hrms.repository;

import com.hrms.model.ClientProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClientProjectAssignmentRepository extends JpaRepository<ClientProjectAssignment, Long> {

    List<ClientProjectAssignment> findByEmployeeIdAndActiveTrue(Long employeeId);

    List<ClientProjectAssignment> findByEmployeeId(Long employeeId);

    /**
     * Every live assignment, across all employees — the population the scheduled Client
     * Timesheet reminders sweep. Read-only; the employees behind these rows are the ones who
     * owe a timesheet each week.
     */
    List<ClientProjectAssignment> findByActiveTrue();
}
