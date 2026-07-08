package com.hrms.controller;

import com.hrms.model.Holiday;
import com.hrms.service.HolidayService;
import com.hrms.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/holidays")
public class HolidayController {

    @Autowired
    private HolidayService holidayService;

    @GetMapping("/year/{year}")
    public ResponseEntity<ApiResponse<List<Holiday>>> getHolidaysByYear(@PathVariable Integer year) {
        List<Holiday> holidays = holidayService.getHolidaysByYear(year);
        return ResponseEntity.ok(ApiResponse.success("Holidays retrieved successfully", holidays));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Holiday>> createHoliday(@Valid @RequestBody Holiday holiday) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        System.out.println("DEBUG: Saving holiday. Auth: " + auth);
        if (auth != null) {
            System.out.println("DEBUG: User: " + auth.getName());
            System.out.println("DEBUG: Authorities: " + auth.getAuthorities().stream()
                    .map(a -> a.getAuthority()).collect(Collectors.joining(", ")));
        }
        Holiday created = holidayService.createHoliday(holiday);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Holiday created successfully", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Holiday>> updateHoliday(@PathVariable Long id,
            @Valid @RequestBody Holiday holiday) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        System.out.println("DEBUG: Updating holiday " + id + ". Auth: " + auth);
        if (auth != null) {
            System.out.println("DEBUG: User: " + auth.getName());
            System.out.println("DEBUG: Authorities: " + auth.getAuthorities().stream()
                    .map(a -> a.getAuthority()).collect(Collectors.joining(", ")));
        }
        Holiday updated = holidayService.updateHoliday(id, holiday);
        return ResponseEntity.ok(ApiResponse.success("Holiday updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<String>> deleteHoliday(@PathVariable Long id) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        System.out.println("DEBUG: Deleting holiday " + id + ". Auth: " + auth);
        if (auth != null) {
            System.out.println("DEBUG: User: " + auth.getName());
            System.out.println("DEBUG: Authorities: " + auth.getAuthorities().stream()
                    .map(a -> a.getAuthority()).collect(Collectors.joining(", ")));
        }
        holidayService.deleteHoliday(id);
        return ResponseEntity.ok(ApiResponse.success("Holiday deleted successfully", null));
    }
}
