package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.CalendarAttendanceDTO;
import com.hrms.service.LeaveService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/attendance")
@CrossOrigin(origins = "http://localhost:5173", allowCredentials = "true") // Specific origin for credentials support
public class AttendanceController {

    @Autowired
    private LeaveService leaveService;

    @GetMapping("/calendar")
    public ResponseEntity<ApiResponse<CalendarAttendanceDTO>> getCalendarAttendance(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate end
    ) {
        System.out.println("API_CALLED: /api/attendance/calendar with start=" + start + " and end=" + end);
        try {
            CalendarAttendanceDTO data = leaveService.getCalendarAttendance(start, end);
            return ResponseEntity.ok(ApiResponse.success(data));
        } catch (Exception e) {
            e.printStackTrace();
            String errorMsg = e.getClass().getSimpleName() + ": " + e.getMessage();
            return ResponseEntity.status(500).body(ApiResponse.error("Internal Server Error: " + errorMsg));
        }
    }
}
