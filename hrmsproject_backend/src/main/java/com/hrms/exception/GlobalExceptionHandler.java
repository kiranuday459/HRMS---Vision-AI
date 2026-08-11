package com.hrms.exception;

import com.hrms.dto.ApiResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationExceptions(
            MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach((error) -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            errors.put(fieldName, errorMessage);
        });
        
        String errorMessage = errors.entrySet().stream()
                .map(e -> e.getKey() + ": " + e.getValue())
                .collect(Collectors.joining(", "));
        
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Validation failed: " + errorMessage));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Object>> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex) {
        String message = ex.getMessage();
        if (message != null && message.contains("JSON parse error")) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Invalid JSON format: " + ex.getMostSpecificCause().getMessage()));
        }
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error("Invalid request body: " + ex.getMessage()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Object>> handleResponseStatusException(
            ResponseStatusException ex) {
        return ResponseEntity
                .status(ex.getStatusCode())
                .body(ApiResponse.error(ex.getReason()));
    }

    /**
     * Database column names mapped to the field label the user actually sees, so a rejected
     * save can name the field instead of asking them to guess which one.
     */
    private static final Map<String, String> COLUMN_LABELS = Map.ofEntries(
            Map.entry("task_description", "Task/Activity Description"),
            // The legacy mirror of task_description — the same field as far as the user is
            // concerned, so it must not surface under its own column name.
            Map.entry("task", "Task/Activity Description"),
            Map.entry("comment", "Comment"),
            Map.entry("billing_location", "Billing Location"),
            Map.entry("project_name", "Project Name"),
            Map.entry("project_id", "Project ID"),
            Map.entry("task_id", "Task/Activity ID"),
            Map.entry("rejection_reason", "Rejection reason"),
            Map.entry("client_name", "Client name"));

    private static final java.util.regex.Pattern TOO_LONG =
            java.util.regex.Pattern.compile("Data too long for column '([^']+)'");
    private static final java.util.regex.Pattern BAD_VALUE =
            java.util.regex.Pattern.compile("Incorrect string value: .* for column '([^']+)'");
    private static final java.util.regex.Pattern NOT_NULL =
            java.util.regex.Pattern.compile("Column '([^']+)' cannot be null");

    private static String labelFor(String column) {
        return COLUMN_LABELS.getOrDefault(column, column);
    }

    /**
     * Turns a driver-level integrity error into something the user can act on.
     *
     * This used to answer every integrity violation with "One or more entries are too long or
     * invalid to save. Please shorten your text and try again." That is a guess, and when it is
     * wrong it is actively misleading — it sends someone shortening a description that was
     * never the problem, and it names no field even when it is right, on a sheet that may carry
     * a dozen text inputs. MySQL states the offending column outright; that is what decides the
     * message now, and anything unrecognised no longer claims to be a length problem.
     *
     * The full driver text still goes to the server log, and never to the browser.
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> handleDataIntegrityViolation(
            DataIntegrityViolationException ex) {
        // Without this these fall through to the generic handler and the raw JDBC text —
        // the whole INSERT statement and driver message — is returned to the browser. It
        // reads as a server crash, so a rejected save/submit looks like nothing happened.
        // The detail stays in the server log; the client gets something actionable.
        Throwable cause = ex.getMostSpecificCause();
        String detail = cause != null ? cause.getMessage() : ex.getMessage();
        System.err.println("[DataIntegrity] " + detail);

        String message = "Couldn't save this change. Please check the entries and try again.";
        if (detail != null) {
            java.util.regex.Matcher tooLong = TOO_LONG.matcher(detail);
            java.util.regex.Matcher badValue = BAD_VALUE.matcher(detail);
            java.util.regex.Matcher notNull = NOT_NULL.matcher(detail);
            if (tooLong.find()) {
                message = labelFor(tooLong.group(1))
                        + " is too long to save. Please shorten it and try again.";
            } else if (badValue.find()) {
                message = labelFor(badValue.group(1))
                        + " contains a character that can't be saved. Please remove it and try again.";
            } else if (notNull.find()) {
                message = labelFor(notNull.group(1)) + " is required.";
            } else if (detail.contains("Duplicate entry")) {
                message = "That record already exists.";
            }
        }
        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(message));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Object>> handleAccessDeniedException(AccessDeniedException ex) {
        // Authorization failures (e.g. @PreAuthorize denials) must return a clean 403 —
        // they must NOT fall through to the generic handler below, which would surface a 500.
        return ResponseEntity
                .status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error("You do not have permission to perform this action"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleGenericException(Exception ex) {
        ex.printStackTrace();
        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error("Internal server error: " + ex.getMessage()));
    }
}

