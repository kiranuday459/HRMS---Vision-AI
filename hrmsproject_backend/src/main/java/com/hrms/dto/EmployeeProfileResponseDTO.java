package com.hrms.dto;

import lombok.*;
import java.util.List;

//@Getter
//@Setter
//@NoArgsConstructor
//@AllArgsConstructor
@Builder
public class EmployeeProfileResponseDTO {

    private EmployeeDTO employee;

    public EmployeeDTO getEmployee() {
		return employee;
	}

	public void setEmployee(EmployeeDTO employee) {
		this.employee = employee;
	}

	public List<EmployeeEducationDTO> getEducationList() {
		return educationList;
	}

	public void setEducationList(List<EmployeeEducationDTO> educationList) {
		this.educationList = educationList;
	}

	public List<EmployeeExperienceDTO> getExperienceList() {
		return experienceList;
	}

	public void setExperienceList(List<EmployeeExperienceDTO> experienceList) {
		this.experienceList = experienceList;
	}

	private List<EmployeeEducationDTO> educationList;

    private List<EmployeeExperienceDTO> experienceList;
}
