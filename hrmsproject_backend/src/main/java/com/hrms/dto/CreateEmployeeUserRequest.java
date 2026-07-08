package com.hrms.dto;

import lombok.Getter;
import lombok.Setter;
//
//@Getter
//@Setter
public class CreateEmployeeUserRequest {

    public String getEmployeeId() {
		return employeeId;
	}

	public void setEmployeeId(String employeeId) {
		this.employeeId = employeeId;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getEmail() {
		return email;
	}

	public void setEmail(String email) {
		this.email = email;
	}

	// Unique employee login ID, entered by admin
    private String employeeId;

    // Display name (can be firstName + lastName)
    private String name;

    // Employee email, used as login email
    private String email;
}



