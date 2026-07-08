package com.hrms.dto;

import lombok.*;

import java.time.LocalDate;

//@Getter
//@Setter
//@NoArgsConstructor
//@AllArgsConstructor
@Builder
public class EmployeeExperienceDTO {

    public EmployeeExperienceDTO(Long id, String employerName, String businessType, String designation,
			LocalDate startDate, LocalDate endDate, String employerAddress, String reportingManagerName,
			String reportingManagerPhone, String reportingManagerEmail) {
		this.id = id;
		this.employerName = employerName;
		this.businessType = businessType;
		this.designation = designation;
		this.startDate = startDate;
		this.endDate = endDate;
		this.employerAddress = employerAddress;
		this.reportingManagerName = reportingManagerName;
		this.reportingManagerPhone = reportingManagerPhone;
		this.reportingManagerEmail = reportingManagerEmail;
	}
	public EmployeeExperienceDTO() {
	}
	private Long id;

    public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getEmployerName() {
		return employerName;
	}
	public void setEmployerName(String employerName) {
		this.employerName = employerName;
	}
	public String getBusinessType() {
		return businessType;
	}
	public void setBusinessType(String businessType) {
		this.businessType = businessType;
	}
	public String getDesignation() {
		return designation;
	}
	public void setDesignation(String designation) {
		this.designation = designation;
	}
	public LocalDate getStartDate() {
		return startDate;
	}
	public void setStartDate(LocalDate startDate) {
		this.startDate = startDate;
	}
	public LocalDate getEndDate() {
		return endDate;
	}
	public void setEndDate(LocalDate endDate) {
		this.endDate = endDate;
	}
	public String getEmployerAddress() {
		return employerAddress;
	}
	public void setEmployerAddress(String employerAddress) {
		this.employerAddress = employerAddress;
	}
	public String getReportingManagerName() {
		return reportingManagerName;
	}
	public void setReportingManagerName(String reportingManagerName) {
		this.reportingManagerName = reportingManagerName;
	}
	public String getReportingManagerPhone() {
		return reportingManagerPhone;
	}
	public void setReportingManagerPhone(String reportingManagerPhone) {
		this.reportingManagerPhone = reportingManagerPhone;
	}
	public String getReportingManagerEmail() {
		return reportingManagerEmail;
	}
	public void setReportingManagerEmail(String reportingManagerEmail) {
		this.reportingManagerEmail = reportingManagerEmail;
	}
	private String employerName;
    private String businessType;
    private String designation;

    private LocalDate startDate;
    private LocalDate endDate;

    private String employerAddress;

    private String reportingManagerName;   // text only (PHASE-1)
    private String reportingManagerPhone;
    private String reportingManagerEmail;
}
