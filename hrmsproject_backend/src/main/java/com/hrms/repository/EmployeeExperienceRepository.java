package com.hrms.repository;

import com.hrms.model.EmployeeExperience;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeExperienceRepository extends JpaRepository<EmployeeExperience, Long> {
    List<EmployeeExperience> findByEmployeeId(Long employeeId);
}


