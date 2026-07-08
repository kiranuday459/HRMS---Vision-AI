package com.hrms.repository;

import com.hrms.model.Leave;
import com.hrms.model.LeaveStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LeaveRepository extends JpaRepository<Leave, Long> {
    List<Leave> findByEmployeeId(Long employeeId);
    List<Leave> findByStatus(LeaveStatus status);
    List<Leave> findByEmployeeIdAndStatus(Long employeeId, LeaveStatus status);

    // Count leaves for an employee whose status is in the given set.
    // Used to block disabling/deleting an employee with pending approvals.
    long countByEmployeeIdAndStatusIn(Long employeeId, java.util.Collection<LeaveStatus> statuses);
    List<Leave> findByEmployeeIdOrderBySubmittedAtDesc(Long employeeId);

    // Fetch leaves for a list of employee IDs
    List<Leave> findByEmployeeIdIn(List<Long> employeeIds);

    List<Leave> findByApprovedBy(com.hrms.model.User user);
}

