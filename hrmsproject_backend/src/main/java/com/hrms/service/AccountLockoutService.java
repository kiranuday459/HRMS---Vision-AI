package com.hrms.service;

import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AccountLockoutService {

    public static final int MAX_ATTEMPTS = 5;
    public static final long LOCKOUT_DURATION_MINUTES = 15;

    private static class LockoutInfo {
        int failedAttempts;
        LocalDateTime lockoutTime;

        LockoutInfo() {
            this.failedAttempts = 0;
            this.lockoutTime = null;
        }
    }

    private final Map<String, LockoutInfo> lockoutMap = new ConcurrentHashMap<>();

    /**
     * Checks if the account is currently locked out.
     * If 15 minutes have passed since lockout, auto-unlocks and returns false.
     */
    public boolean isLocked(String username) {
        if (username == null || username.isBlank()) {
            return false;
        }
        String key = username.trim().toLowerCase();
        LockoutInfo info = lockoutMap.get(key);
        if (info == null || info.failedAttempts < MAX_ATTEMPTS) {
            return false;
        }

        if (info.lockoutTime != null) {
            LocalDateTime unlockTime = info.lockoutTime.plusMinutes(LOCKOUT_DURATION_MINUTES);
            if (LocalDateTime.now().isBefore(unlockTime)) {
                return true; // Still within 15-minute cooldown
            } else {
                // Cooldown period expired -> reset lockout
                lockoutMap.remove(key);
                return false;
            }
        }
        return false;
    }

    /**
     * Returns remaining lockout duration in minutes (rounded up).
     */
    public long getRemainingLockoutMinutes(String username) {
        if (username == null || username.isBlank()) {
            return 0;
        }
        String key = username.trim().toLowerCase();
        LockoutInfo info = lockoutMap.get(key);
        if (info == null || info.lockoutTime == null) {
            return 0;
        }

        LocalDateTime unlockTime = info.lockoutTime.plusMinutes(LOCKOUT_DURATION_MINUTES);
        Duration remaining = Duration.between(LocalDateTime.now(), unlockTime);
        long seconds = remaining.getSeconds();
        if (seconds <= 0) {
            return 0;
        }
        return (seconds + 59) / 60; // Round up to nearest minute
    }

    /**
     * Returns remaining lockout duration in exact seconds.
     */
    public long getRemainingLockoutSeconds(String username) {
        if (username == null || username.isBlank()) {
            return 0;
        }
        String key = username.trim().toLowerCase();
        LockoutInfo info = lockoutMap.get(key);
        if (info == null || info.lockoutTime == null) {
            return 0;
        }

        LocalDateTime unlockTime = info.lockoutTime.plusMinutes(LOCKOUT_DURATION_MINUTES);
        Duration remaining = Duration.between(LocalDateTime.now(), unlockTime);
        return Math.max(0, remaining.getSeconds());
    }

    /**
     * Records a failed login attempt for the specified account.
     * Returns total failed attempts so far.
     */
    public int recordFailedAttempt(String username) {
        if (username == null || username.isBlank()) {
            return 0;
        }
        String key = username.trim().toLowerCase();

        LockoutInfo info = lockoutMap.computeIfAbsent(key, k -> new LockoutInfo());

        // If previously locked but cooldown expired, reset count first
        if (info.lockoutTime != null && LocalDateTime.now().isAfter(info.lockoutTime.plusMinutes(LOCKOUT_DURATION_MINUTES))) {
            info.failedAttempts = 0;
            info.lockoutTime = null;
        }

        info.failedAttempts++;

        if (info.failedAttempts >= MAX_ATTEMPTS && info.lockoutTime == null) {
            info.lockoutTime = LocalDateTime.now();
        }

        return info.failedAttempts;
    }

    /**
     * Gets current failed attempt count for username.
     */
    public int getFailedAttempts(String username) {
        if (username == null || username.isBlank()) {
            return 0;
        }
        String key = username.trim().toLowerCase();
        LockoutInfo info = lockoutMap.get(key);
        return info != null ? info.failedAttempts : 0;
    }

    /**
     * Resets failed login attempt tracking upon a successful login post-cooldown.
     */
    public void resetAttempts(String username) {
        if (username == null || username.isBlank()) {
            return;
        }
        String key = username.trim().toLowerCase();
        lockoutMap.remove(key);
    }
}
