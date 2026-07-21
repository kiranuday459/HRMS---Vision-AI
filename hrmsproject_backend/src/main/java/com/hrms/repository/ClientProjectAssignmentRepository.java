package com.hrms.repository;

import com.hrms.model.ClientProjectAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClientProjectAssignmentRepository extends JpaRepository<ClientProjectAssignment, Long> {

    List<ClientProjectAssignment> findByEmployeeIdAndActiveTrue(Long employeeId);

    List<ClientProjectAssignment> findByEmployeeId(Long employeeId);
}
