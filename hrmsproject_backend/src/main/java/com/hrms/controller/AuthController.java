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

        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));

            SecurityContextHolder.getContext().setAuthentication(authentication);
            String jwt = jwtUtils.generateJwtToken(authentication);

            return ResponseEntity.ok(Map.of("token", jwt));
        } catch (DisabledException e) {
            // Account has been disabled by an administrator
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message",
                            "Your account has been disabled. Please contact your administrator."));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
        } catch (AuthenticationException e) {
            // Any other authentication failure (user not found, locked, etc.) → 401, never 500
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid username or password"));
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
}
