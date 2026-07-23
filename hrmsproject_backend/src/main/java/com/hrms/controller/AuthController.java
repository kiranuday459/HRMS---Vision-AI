package com.hrms.controller;

import com.hrms.model.User;
import com.hrms.repository.UserRepository;
import com.hrms.service.EmailService;
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import com.hrms.service.AccountLockoutService;
import com.hrms.security.JwtUtils;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtils jwtUtils;

    @Autowired
    private AccountLockoutService accountLockoutService;

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String username = body.get("username");
        String password = body.get("password");

        // Missing input → 400 (never let a null credential bubble up as a 500)
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Username and password are required"));
        }

        String accountKey = username.trim().toLowerCase();

        // 1. Lockout Check MUST occur BEFORE password validation on subsequent attempts
        if (accountLockoutService.isLocked(accountKey)) {
            long remainingSecs = accountLockoutService.getRemainingLockoutSeconds(accountKey);
            long minutes = remainingSecs / 60;
            long seconds = remainingSecs % 60;
            String timeFormatted = String.format("%02d:%02d", minutes, seconds);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of(
                            "message", "Too Many Attempts.\nPlease try again in " + timeFormatted + ".",
                            "lockoutSeconds", remainingSecs
                    ));
        }

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));

            // Reset failed attempts counter on successful login post-cooldown
            accountLockoutService.resetAttempts(accountKey);

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateJwtToken(authentication);

            return ResponseEntity.ok(Map.of("token", jwt));
        } catch (DisabledException e) {
            // Account has been disabled by an administrator
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message",
                            "Your account has been disabled. Please contact your administrator."));
        } catch (AuthenticationException e) {
            int attempts = accountLockoutService.recordFailedAttempt(accountKey);
            if (attempts >= AccountLockoutService.MAX_ATTEMPTS) {
                long remainingSecs = accountLockoutService.getRemainingLockoutSeconds(accountKey);
                long minutes = remainingSecs / 60;
                long seconds = remainingSecs % 60;
                String timeFormatted = String.format("%02d:%02d", minutes, seconds);
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(Map.of(
                                "message", "Too Many Attempts.\nPlease try again in " + timeFormatted + ".",
                                "lockoutSeconds", remainingSecs
                        ));
            } else {
                int remainingAttempts = AccountLockoutService.MAX_ATTEMPTS - attempts;
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Invalid username or password.\nRemaining Attempts: " + remainingAttempts));
            }
        } catch (Exception e) {
            // Unexpected server/DB error — log server-side only, do not leak internals
            System.err.println("Login error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "An unexpected error occurred. Please try again."));
        }
    }

    @PostMapping("/auth/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestParam String email) {
        Optional<User> userOptional = userRepository.findByEmail(email);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            String otp = String.format("%06d", new Random().nextInt(999999));
            user.setResetPasswordOtp(otp);
            user.setOtpExpiry(LocalDateTime.now().plusMinutes(10));
            userRepository.save(user);

            try {
                emailService.sendOtpEmail(email, otp);
            } catch (Exception e) {
                // Log the error but maybe return OK if we want to obscure user existence
                // (though frontend expects error)
                // For now, let's just log and return OK because we saved the OTP.
                // Actually, the frontend catches error as "Email not found", which is a bit
                // misleading if it's a mail error.
                System.out.println("Failed to send email: " + e.getMessage());
                // In development, showing the OTP in console is helpful
                System.out.println("OTP for " + email + " is: " + otp);
            }
            return ResponseEntity.ok(Map.of("message", "OTP sent successfully"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Email not found"));
    }

    @PostMapping("/auth/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestParam String email, @RequestParam String otp) {
        Optional<User> userOptional = userRepository.findByEmail(email);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            if (user.getResetPasswordOtp() != null &&
                    user.getResetPasswordOtp().equals(otp) &&
                    user.getOtpExpiry().isAfter(LocalDateTime.now())) {
                return ResponseEntity.ok(Map.of("message", "OTP verified successfully"));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid or expired OTP"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Email not found"));
    }

    @PostMapping("/auth/reset-password")
    public ResponseEntity<?> resetPassword(@RequestParam String email, @RequestParam String otp,
            @RequestParam String newPassword) {
        String validationError = validatePassword(newPassword);
        if (validationError != null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", validationError));
        }

        Optional<User> userOptional = userRepository.findByEmail(email);
        if (userOptional.isPresent()) {
            User user = userOptional.get();
            if (user.getResetPasswordOtp() != null &&
                    user.getResetPasswordOtp().equals(otp) &&
                    user.getOtpExpiry().isAfter(LocalDateTime.now())) {

                user.setPassword(passwordEncoder.encode(newPassword));
                user.setResetPasswordOtp(null);
                user.setOtpExpiry(null);
                userRepository.save(user);
                return ResponseEntity.ok(Map.of("message", "Password reset successful"));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "Invalid or expired OTP"));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Email not found"));
    }

    public static String validatePassword(String password) {
        if (password == null || password.trim().isEmpty()) {
            return "Password is required";
        }
        if (password.length() < 8) {
            return "Password must be at least 8 characters long";
        }
        if (!password.matches(".*[A-Z].*")) {
            return "Password must contain at least one uppercase letter";
        }
        if (!password.matches(".*[a-z].*")) {
            return "Password must contain at least one lowercase letter";
        }
        if (!password.matches(".*[0-9].*")) {
            return "Password must contain at least one number";
        }
        if (!password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?~`].*")) {
            return "Password must contain at least one special character";
        }
        if (password.matches(".*(.)\\1{2,}.*")) {
            return "Password must not contain repeated characters (e.g. aaaa, 1111)";
        }

        String lower = password.toLowerCase();
        for (int i = 0; i < lower.length() - 2; i++) {
            char c1 = lower.charAt(i);
            char c2 = lower.charAt(i + 1);
            char c3 = lower.charAt(i + 2);

            if (c2 == c1 + 1 && c3 == c2 + 1) {
                if ((c1 >= '0' && c3 <= '9') || (c1 >= 'a' && c3 <= 'z')) {
                    return "Password must not contain sequential characters (e.g. 1234 or abcd)";
                }
            }
            if (c2 == c1 - 1 && c3 == c2 - 1) {
                if ((c3 >= '0' && c1 <= '9') || (c3 >= 'a' && c1 <= 'z')) {
                    return "Password must not contain sequential characters (e.g. 1234 or abcd)";
                }
            }
        }

        String[] keyboardPatterns = {"qwerty", "wertyu", "ertyui", "rtyuio", "tyuiop", "asdfgh", "sdfghj", "dfghjk", "fghjkl", "zxcvbn", "xcvbnm"};
        for (String pat : keyboardPatterns) {
            for (int i = 0; i <= pat.length() - 3; i++) {
                String sub = pat.substring(i, i + 3);
                if (lower.contains(sub)) {
                    return "Password must not contain sequential keyboard patterns (e.g. qwerty)";
                }
            }
        }

        String[] commonWeak = {"password", "pass1234", "qwerty", "admin", "admin123", "welcome", "12345678", "123456789", "letmein", "hrms1234", "p@ssword"};
        for (String weak : commonWeak) {
            if (lower.contains(weak)) {
                return "Password is too common or easily guessable";
            }
        }

        return null;
    }
}
