package com.hrms.repository;

import com.hrms.model.ClientTimesheetWeek;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ClientTimesheetWeekRepository extends JpaRepository<ClientTimesheetWeek, Long> {

    List<ClientTimesheetWeek> findByEmployeeIdOrderByWeekStartDateDesc(Long employeeId);

    Optional<ClientTimesheetWeek> findByEmployeeIdAndWeekStartDate(Long employeeId, LocalDate weekStartDate);
}
