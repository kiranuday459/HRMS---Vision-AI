package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.NotificationDTO;
import com.hrms.model.UserPrincipal;
import com.hrms.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<NotificationDTO>>> getNotifications(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        List<NotificationDTO> notifications = notificationService.getNotificationsForUser(principal.getUser().getId());
        return ResponseEntity.ok(ApiResponse.success(notifications));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> getUnreadCount(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.noContent().build();
        }
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        long count = notificationService.getUnreadCount(principal.getUser().getId());
        return ResponseEntity.ok(ApiResponse.success(count));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", null));
    }

    @PostMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllAsRead(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Not authenticated"));
        }
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        notificationService.markAllAsRead(principal.getUser().getId());
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteNotification(@PathVariable Long id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.ok(ApiResponse.success("Notification deleted", null));
    }
}
