package com.hrms.repository;

import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByEmail(String email);
    Optional<Employee> findByPhoneNumber(String phoneNumber);

    Optional<Employee> findByUser(User user); // Added findByUser method

    Optional<Employee> findByUser_Id(Long userId);

    List<Employee> findByUser_Role(Role role); // Modified to use imported Role

    @org.springframework.data.jpa.repository.Query("SELECT e FROM Employee e WHERE e.id NOT IN (SELECT cd.employee.id FROM CompanyDetail cd)")
    List<Employee> findEmployeesWithoutCompanyDetails();

    List<Employee> findByReportingManager(Employee manager);
}
