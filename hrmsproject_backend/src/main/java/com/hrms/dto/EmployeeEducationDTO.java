package com.hrms.dto;

import lombok.*;

//@Getter
//@Setter
//@NoArgsConstructor
//@AllArgsConstructor
@Builder
public class EmployeeEducationDTO {

    public EmployeeEducationDTO(Long id, String institutionName, String degreeLevel, Integer startYear,
			Integer endYear) {
		this.id = id;
		this.institutionName = institutionName;
		this.degreeLevel = degreeLevel;
		this.startYear = startYear;
		this.endYear = endYear;
	}
	public EmployeeEducationDTO() {
	}
	public Long getId() {
		return id;
	}
	public void setId(Long id) {
		this.id = id;
	}
	public String getInstitutionName() {
		return institutionName;
	}
	public void setInstitutionName(String institutionName) {
		this.institutionName = institutionName;
	}
	public String getDegreeLevel() {
		return degreeLevel;
	}
	public void setDegreeLevel(String degreeLevel) {
		this.degreeLevel = degreeLevel;
	}
	public Integer getStartYear() {
		return startYear;
	}
	public void setStartYear(Integer startYear) {
		this.startYear = startYear;
	}
	public Integer getEndYear() {
		return endYear;
	}
	public void setEndYear(Integer endYear) {
		this.endYear = endYear;
	}
	private Long id;

    private String institutionName;   // School / College
    private String degreeLevel;        // 10th / Inter / BTech
    private Integer startYear;
    private Integer endYear;
}
