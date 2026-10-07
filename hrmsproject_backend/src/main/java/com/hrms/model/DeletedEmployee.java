package com.hrms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Snapshot of an employee's core details, captured immediately before the
 * hard-delete executes. The record is written inside the same transaction so
 * it is either both committed or both rolled back.
 *
 * Fields are denormalised (plain strings) so the archive remains readable even
 * after the referenced department, reporting-manager etc. rows are gone.
 */
@Entity
@Table(name = "deleted_employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeletedEmployee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Identity ──────────────────────────────────────────────────────────────
    /** The original employees.id — kept for reference, no FK constraint. */
    private Long originalEmployeeId;

    private String firstName;
    private String middleName;
    private String lastName;

    /** Personal e-mail (from employees.email). */
    private String email;

    // ── Company record ────────────────────────────────────────────────────────
    /** Corporate / Oryfolks ID (company_details.oryfolks_id). */
    private String corporateId;

    /** Corporate e-mail (company_details.oryfolks_mail_id). */
    private String corporateEmail;

    /** VisionAI employee ID (company_details.visionai_id). */
    private String visionaiId;

    /** VisionAI corporate e-mail (company_details.visionai_mail_id). */
    private String visionaiEmail;

    /** Job title at time of deletion. */
    private String designation;

    // ── Role & department ─────────────────────────────────────────────────────
    /** ADMIN / HR / REPORTING_MANAGER / EMPLOYEE (denormalised from User.role). */
    private String role;

    /** Department name at time of deletion (denormalised). */
    private String department;

    // ── Dates ─────────────────────────────────────────────────────────────────
    private LocalDate hireDate;
    private LocalDate joiningDate;
    private LocalDate endDate;

    /** UTC instant at which the admin pressed "Delete". */
    private LocalDateTime deletedAt;

    // ── Client project (denormalised) ─────────────────────────────────────────
    private String clientProject;
    private String clientProjectId;

    // ── Contact (kept for audit reference) ───────────────────────────────────
    private String phoneNumber;

    @PrePersist
    protected void onCreate() {
        if (deletedAt == null) {
            deletedAt = LocalDateTime.now();
        }
    }
}
