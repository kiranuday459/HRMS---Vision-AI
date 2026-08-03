package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.ClientTimesheetNotificationDTO;
import com.hrms.model.UserPrincipal;
import com.hrms.service.ClientTimesheetNotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Bell panel API for the Client Timesheet workspace. Serves both the employee and admin
 * sides — each caller only ever sees rows addressed to their own user.
 *
 * Separate base path and separate table from the main HRMS notifications API
 * (/api/notifications), which is left completely untouched.
 */
@RestController
@RequestMapping("/api/client-timesheet/notifications")
@CrossOrigin(origins = "http://localhost:3000")
public class ClientTimesheetNotificationController {

    private static final int MAX_PAGE_SIZE = 50;

    @Autowired
    private ClientTimesheetNotificationService notificationService;

    private Long currentUserId(Authentication authentication) {
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getUser().getId();
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        Page<ClientTimesheetNotificationDTO> result =
                notificationService.getForUser(userId, page, Math.min(size, MAX_PAGE_SIZE));

        // hasMore drives "Load More" — the panel appends pages rather than loading history at once.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", result.getContent());
        body.put("page", result.getNumber());
        body.put("totalPages", result.getTotalPages());
        body.put("totalElements", result.getTotalElements());
        body.put("hasMore", result.getNumber() + 1 < result.getTotalPages());
        body.put("unreadCount", notificationService.getUnreadCount(userId));
        return ResponseEntity.ok(ApiResponse.success(body));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<ApiResponse<Long>> unreadCount(Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        return ResponseEntity.ok(ApiResponse.success(notificationService.getUnreadCount(userId)));
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<ApiResponse<Void>> markRead(@PathVariable Long id, Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        notificationService.markAsRead(userId, id);
        return ResponseEntity.ok(ApiResponse.success("Notification marked as read", null));
    }

    @PostMapping("/read-all")
    public ResponseEntity<ApiResponse<Void>> markAllRead(Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok(ApiResponse.success("All notifications marked as read", null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id, Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        notificationService.delete(userId, id);
        return ResponseEntity.ok(ApiResponse.success("Notification deleted", null));
    }

    @DeleteMapping
    public ResponseEntity<ApiResponse<Void>> clearAll(Authentication authentication) {
        Long userId = currentUserId(authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Not authenticated"));
        }
        notificationService.clearAll(userId);
        return ResponseEntity.ok(ApiResponse.success("All notifications cleared", null));
    }
}
