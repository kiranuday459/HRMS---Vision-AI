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

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM Notification n WHERE n.user = :user")
    void deleteByUser(@org.springframework.data.repository.query.Param("user") User user);
}
