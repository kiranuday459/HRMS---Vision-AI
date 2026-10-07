package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.model.DeletedEmployee;
import com.hrms.repository.DeletedEmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Read-only access to the deleted-employee archive.
 * Accessible to ADMIN and HR only.
 */
@RestController
@RequestMapping("/api/admin/deleted-employees")
public class DeletedEmployeeController {

    @Autowired
    private DeletedEmployeeRepository deletedEmployeeRepository;

    /** Returns all deleted-employee snapshots, newest first. */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR')")
    public ResponseEntity<ApiResponse<List<DeletedEmployee>>> getAll() {
        List<DeletedEmployee> records = deletedEmployeeRepository.findAllByOrderByDeletedAtDesc();
        return ResponseEntity.ok(ApiResponse.success("Deleted employees fetched", records));
    }
}
