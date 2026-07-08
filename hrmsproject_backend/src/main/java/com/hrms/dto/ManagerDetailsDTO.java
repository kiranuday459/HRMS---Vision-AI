package com.hrms.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManagerDetailsDTO {
    private Long id;
    private String fullName;
    private String email;
    private String corporateEmail;
    private List<EmployeeSimpleDTO> team;
}
