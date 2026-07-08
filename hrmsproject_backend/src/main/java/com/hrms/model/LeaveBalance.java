package com.hrms.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "leave_balances")
public class LeaveBalance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "employee_id", nullable = false, unique = true)
    @JsonIgnore
    private Employee employee;

    // Tracks the entitlement cycle this balance row currently represents.
    // Used by the year-end job to know if a roll-over already happened.
    private Integer currentYear;

    private Double casualLeavesTotal = 0.0;
    private Double casualLeavesUsed = 0.0;
    // Carry-forwarded from the previous cycle. Expires at next year-end if unused.
    private Double casualLeavesCarriedForward = 0.0;

    private Double sickLeavesTotal = 0.0;
    private Double sickLeavesUsed = 0.0;

    private Double earnedLeavesTotal = 0.0;
    private Double earnedLeavesUsed = 0.0;
    private Double earnedLeavesCarriedForward = 0.0;

    private Double maternityLeavesTotal = 0.0;
    private Double maternityLeavesUsed = 0.0;

    private Double paternityLeavesTotal = 0.0;
    private Double paternityLeavesUsed = 0.0;

    private Double bereavementLeavesTotal = 0.0;
    private Double bereavementLeavesUsed = 0.0;

    private LocalDateTime lastUpdated;

    @PrePersist
    protected void onCreate() {
        lastUpdated = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }

    // ===== Helpers =====
    private static double safe(Double v) { return v != null ? v : 0.0; }
    private static double round2(double v) { return Math.round(v * 100.0) / 100.0; }

    // ===== Getters / Setters =====

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }

    public Integer getCurrentYear() { return currentYear; }
    public void setCurrentYear(Integer currentYear) { this.currentYear = currentYear; }

    public Double getCasualLeavesTotal() { return casualLeavesTotal; }
    public void setCasualLeavesTotal(Double v) { this.casualLeavesTotal = v; }
    public Double getCasualLeavesUsed() { return casualLeavesUsed; }
    public void setCasualLeavesUsed(Double v) { this.casualLeavesUsed = v; }
    public Double getCasualLeavesCarriedForward() { return casualLeavesCarriedForward; }
    public void setCasualLeavesCarriedForward(Double v) { this.casualLeavesCarriedForward = v; }
    public Double getCasualLeavesRemaining() {
        return round2(safe(casualLeavesTotal) + safe(casualLeavesCarriedForward) - safe(casualLeavesUsed));
    }

    public Double getSickLeavesTotal() { return sickLeavesTotal; }
    public void setSickLeavesTotal(Double v) { this.sickLeavesTotal = v; }
    public Double getSickLeavesUsed() { return sickLeavesUsed; }
    public void setSickLeavesUsed(Double v) { this.sickLeavesUsed = v; }
    public Double getSickLeavesRemaining() {
        return round2(safe(sickLeavesTotal) - safe(sickLeavesUsed));
    }

    public Double getEarnedLeavesTotal() { return earnedLeavesTotal; }
    public void setEarnedLeavesTotal(Double v) { this.earnedLeavesTotal = v; }
    public Double getEarnedLeavesUsed() { return earnedLeavesUsed; }
    public void setEarnedLeavesUsed(Double v) { this.earnedLeavesUsed = v; }
    public Double getEarnedLeavesCarriedForward() { return earnedLeavesCarriedForward; }
    public void setEarnedLeavesCarriedForward(Double v) { this.earnedLeavesCarriedForward = v; }
    public Double getEarnedLeavesRemaining() {
        return round2(safe(earnedLeavesTotal) + safe(earnedLeavesCarriedForward) - safe(earnedLeavesUsed));
    }

    public Double getMaternityLeavesTotal() { return maternityLeavesTotal; }
    public void setMaternityLeavesTotal(Double v) { this.maternityLeavesTotal = v; }
    public Double getMaternityLeavesUsed() { return maternityLeavesUsed; }
    public void setMaternityLeavesUsed(Double v) { this.maternityLeavesUsed = v; }
    public Double getMaternityLeavesRemaining() {
        return round2(safe(maternityLeavesTotal) - safe(maternityLeavesUsed));
    }

    public Double getPaternityLeavesTotal() { return paternityLeavesTotal; }
    public void setPaternityLeavesTotal(Double v) { this.paternityLeavesTotal = v; }
    public Double getPaternityLeavesUsed() { return paternityLeavesUsed; }
    public void setPaternityLeavesUsed(Double v) { this.paternityLeavesUsed = v; }
    public Double getPaternityLeavesRemaining() {
        return round2(safe(paternityLeavesTotal) - safe(paternityLeavesUsed));
    }

    public Double getBereavementLeavesTotal() { return bereavementLeavesTotal; }
    public void setBereavementLeavesTotal(Double v) { this.bereavementLeavesTotal = v; }
    public Double getBereavementLeavesUsed() { return bereavementLeavesUsed; }
    public void setBereavementLeavesUsed(Double v) { this.bereavementLeavesUsed = v; }
    public Double getBereavementLeavesRemaining() {
        return round2(safe(bereavementLeavesTotal) - safe(bereavementLeavesUsed));
    }

    public LocalDateTime getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(LocalDateTime lastUpdated) { this.lastUpdated = lastUpdated; }
}
