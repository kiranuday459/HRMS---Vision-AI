package com.hrms.repository;

import com.hrms.model.Notification;
import com.hrms.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserOrderByCreatedAtDesc(User user);
    long countByUserAndIsReadFalse(User user);
    boolean existsByUserAndTitleAndMessageAndTypeAndIsReadFalse(User user, String title, String message, String type);
}
