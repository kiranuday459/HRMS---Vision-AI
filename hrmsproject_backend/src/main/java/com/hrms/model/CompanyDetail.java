package com.hrms.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "company_details")
public class CompanyDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "employee_id", nullable = false, unique = true)
    @JsonIgnore
    private Employee employee;

    @Column(nullable = false, unique = true)
    private String oryfolksId;

    @Column(nullable = false, unique = true)
    private String oryfolksMailId;

    @Column(nullable = false)
    private String visionaiId;

    @Column(nullable = false)
    private String visionaiMailId;

    @Column(nullable = false)
    private String designation;

    @Column(nullable = true)
    private java.time.LocalDate joiningDate;

    public CompanyDetail() {}

    public CompanyDetail(Employee employee, String oryfolksId, String oryfolksMailId, String designation, java.time.LocalDate joiningDate) {
        this.employee = employee;
        this.oryfolksId = oryfolksId;
        this.oryfolksMailId = oryfolksMailId;
        this.visionaiId = oryfolksId;  // Defaults to oryfolksId if not explicitly set
        this.visionaiMailId = oryfolksMailId;  // Defaults to oryfolksMailId if not explicitly set
        this.designation = designation;
        this.joiningDate = joiningDate;
    }

    public java.time.LocalDate getJoiningDate() {
        return joiningDate;
    }

    public void setJoiningDate(java.time.LocalDate joiningDate) {
        this.joiningDate = joiningDate;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Employee getEmployee() {
        return employee;
    }

    public void setEmployee(Employee employee) {
        this.employee = employee;
    }

    public String getOryfolksId() {
        return oryfolksId;
    }

    public void setOryfolksId(String oryfolksId) {
        this.oryfolksId = oryfolksId;
    }

    public String getOryfolksMailId() {
        return oryfolksMailId;
    }

    public void setOryfolksMailId(String oryfolksMailId) {
        this.oryfolksMailId = oryfolksMailId;
    }

    public String getDesignation() {
        return designation;
    }

    public void setDesignation(String designation) {
        this.designation = designation;
    }

    public String getVisionaiId() {
        return visionaiId;
    }

    public void setVisionaiId(String visionaiId) {
        this.visionaiId = visionaiId;
    }

    public String getVisionaiMailId() {
        return visionaiMailId;
    }

    public void setVisionaiMailId(String visionaiMailId) {
        this.visionaiMailId = visionaiMailId;
    }
}
