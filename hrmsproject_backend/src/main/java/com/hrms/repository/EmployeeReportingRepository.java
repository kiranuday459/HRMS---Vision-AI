package com.hrms.repository;

import com.hrms.model.EmployeeReporting;
import com.hrms.model.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface EmployeeReportingRepository extends JpaRepository<EmployeeReporting, Long> {
    Optional<EmployeeReporting> findByEmployee(Employee employee);

    // Tolerant lookup: an employee may have more than one reporting row (e.g. after a
    // re-assignment). Return the most recent one (highest id) so a duplicate row never
    // triggers "Query did not return a unique result" inside convertToDTO / getAllEmployees.
    Optional<EmployeeReporting> findFirstByEmployeeOrderByIdDesc(Employee employee);

    @Query("SELECT DISTINCT er.reportingManager FROM EmployeeReporting er WHERE er.reportingManager IS NOT NULL")
    List<Employee> findDistinctReportingManagers();

    List<EmployeeReporting> findAllByReportingManager_Id(Long managerId);

    List<EmployeeReporting> findAllByReportingManager(Employee manager);
    
    Optional<EmployeeReporting> findByEmployee_Id(Long employeeId);

    List<EmployeeReporting> findByHr(Employee hr);

    List<EmployeeReporting> findByPreviousReportingManager(Employee manager);
}
