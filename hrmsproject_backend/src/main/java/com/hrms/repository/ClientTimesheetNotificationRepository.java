package com.hrms.repository;

import com.hrms.model.ClientTimesheetNotification;
import com.hrms.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;

/**
 * Repository for {@link ClientTimesheetNotification}. Every query touches only
 * client_timesheet_notifications — nothing here references the main HRMS `notifications`
 * table, so the two bells stay independent.
 */
@Repository
public interface ClientTimesheetNotificationRepository extends JpaRepository<ClientTimesheetNotification, Long> {

    Page<ClientTimesheetNotification> findByUserOrderByCreatedAtDesc(User user, Pageable pageable);

    long countByUserAndIsReadFalse(User user);

    /**
     * Admin approve/reject act on one line row per day, so a single week decision calls
     * the notifier up to seven times. Collapse those into one unread row per week.
     */
    boolean existsByUserAndEventTypeAndRelatedWeekStartAndIsReadFalse(
            User user, String eventType, LocalDate relatedWeekStart);

    @Modifying
    @Query("UPDATE ClientTimesheetNotification n SET n.isRead = true WHERE n.user = :user AND n.isRead = false")
    int markAllReadForUser(@Param("user") User user);

    @Modifying
    @Query("DELETE FROM ClientTimesheetNotification n WHERE n.user = :user")
    int deleteAllForUser(@Param("user") User user);
}
