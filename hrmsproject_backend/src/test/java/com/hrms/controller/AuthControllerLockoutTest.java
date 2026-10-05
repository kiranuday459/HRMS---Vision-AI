package com.hrms.controller;

import com.hrms.service.AccountLockoutService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthControllerLockoutTest {

    @Mock
    private AccountLockoutService accountLockoutService;

    @InjectMocks
    private AuthController authController;

    @Test
    public void testGetLockoutStatusWhenEmptyUsername() {
        ResponseEntity<?> response = authController.getLockoutStatus(null);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("isLocked"));
        assertEquals(0, body.get("lockoutSeconds"));
        assertEquals(5, body.get("remainingAttempts"));
    }

    @Test
    public void testGetLockoutStatusWhenUserIsLocked() {
        when(accountLockoutService.isLocked("lockeduser")).thenReturn(true);
        when(accountLockoutService.getRemainingLockoutSeconds("lockeduser")).thenReturn(600L);
        when(accountLockoutService.getFailedAttempts("lockeduser")).thenReturn(5);

        ResponseEntity<?> response = authController.getLockoutStatus("lockeduser");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("isLocked"));
        assertEquals(600L, body.get("lockoutSeconds"));
        assertEquals(0, body.get("remainingAttempts"));
        assertTrue(((String) body.get("message")).contains("temporarily locked"));
    }

    @Test
    public void testGetLockoutStatusWhenUserHasFailedAttempts() {
        when(accountLockoutService.isLocked("activeuser")).thenReturn(false);
        when(accountLockoutService.getRemainingLockoutSeconds("activeuser")).thenReturn(0L);
        when(accountLockoutService.getFailedAttempts("activeuser")).thenReturn(2);

        ResponseEntity<?> response = authController.getLockoutStatus("activeuser");
        assertEquals(HttpStatus.OK, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(false, body.get("isLocked"));
        assertEquals(3, body.get("remainingAttempts"));
    }

    @Test
    public void testLoginBlockedWhenUserIsLocked() {
        when(accountLockoutService.isLocked("lockeduser")).thenReturn(true);
        when(accountLockoutService.getRemainingLockoutSeconds("lockeduser")).thenReturn(900L);

        ResponseEntity<?> response = authController.login(
                Map.of("username", "lockeduser", "password", "Password123!"),
                null
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertNotNull(body);
        assertEquals(true, body.get("isLocked"));
        assertEquals(0, body.get("remainingAttempts"));
    }
}
