package com.hrms.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "employee_reporting")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeReporting {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    @JsonIgnore
    private Employee employee;

    @ManyToOne(optional = true)
    @JoinColumn(name = "reporting_manager_id")
    @JsonIgnore
    private Employee reportingManager;

    @ManyToOne(optional = true)
    @JoinColumn(name = "hr_id")
    @JsonIgnore
    private Employee hr;

    @ManyToOne(optional = true)
    @JoinColumn(name = "previous_reporting_manager_id")
    @JsonIgnore
    private Employee previousReportingManager;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
