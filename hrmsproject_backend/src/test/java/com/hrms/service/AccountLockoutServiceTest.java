package com.hrms.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

public class AccountLockoutServiceTest {

    private AccountLockoutService lockoutService;

    @BeforeEach
    public void setUp() {
        lockoutService = new AccountLockoutService();
    }

    @Test
    public void testInitialStateNotLocked() {
        assertFalse(lockoutService.isLocked("user1"));
        assertEquals(0, lockoutService.getFailedAttempts("user1"));
        assertEquals(0, lockoutService.getRemainingLockoutSeconds("user1"));
    }

    @Test
    public void testFailedAttemptsIncrementCorrectly() {
        assertEquals(1, lockoutService.recordFailedAttempt("user1"));
        assertEquals(2, lockoutService.recordFailedAttempt("user1"));
        assertEquals(3, lockoutService.recordFailedAttempt("user1"));
        assertEquals(4, lockoutService.recordFailedAttempt("user1"));

        assertFalse(lockoutService.isLocked("user1"));
        assertEquals(4, lockoutService.getFailedAttempts("user1"));
    }

    @Test
    public void testAccountLocksOnFifthFailedAttempt() {
        for (int i = 1; i <= 4; i++) {
            lockoutService.recordFailedAttempt("user1");
        }
        assertFalse(lockoutService.isLocked("user1"));

        // 5th failed attempt triggers lockout
        int attempts = lockoutService.recordFailedAttempt("user1");
        assertEquals(5, attempts);
        assertTrue(lockoutService.isLocked("user1"));
        assertTrue(lockoutService.getRemainingLockoutSeconds("user1") > 0);
    }

    @Test
    public void testSuccessfulLoginResetsAttempts() {
        lockoutService.recordFailedAttempt("user1");
        lockoutService.recordFailedAttempt("user1");
        assertEquals(2, lockoutService.getFailedAttempts("user1"));

        lockoutService.resetAttempts("user1");
        assertEquals(0, lockoutService.getFailedAttempts("user1"));
        assertFalse(lockoutService.isLocked("user1"));
    }

    @Test
    public void testCaseInsensitiveAndTrimmedUsernames() {
        lockoutService.recordFailedAttempt("  User1  ");
        assertEquals(1, lockoutService.getFailedAttempts("user1"));
        assertEquals(1, lockoutService.getFailedAttempts("USER1"));
    }
}
