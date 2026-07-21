package com.hrms.repository;

import com.hrms.model.TimesheetNotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;

@Repository
public interface TimesheetNotificationLogRepository extends JpaRepository<TimesheetNotificationLog, Long> {
    boolean existsByEmployeeIdAndWeekStartAndNotificationType(Long employeeId, LocalDate weekStart, String notificationType);
    boolean existsByEmployeeIsNullAndWeekStartAndNotificationType(LocalDate weekStart, String notificationType);
}
