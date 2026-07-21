package com.hrms.dto;

import java.time.LocalDate;

/**
 * Client-timesheet access snapshot for the logged-in employee. Read on every login and
 * kept in front-end app state to drive sidebar visibility and the activation banner.
 * Never carries OTP secrets.
 */
public class ClientAccessStatusDTO {

    private boolean clientAssigned;
    private boolean clientVerified;
    private String clientProject;
    private String clientProjectId;
    private LocalDate clientAssignmentDate;

    public ClientAccessStatusDTO() {}

    public ClientAccessStatusDTO(boolean clientAssigned, boolean clientVerified,
                                 String clientProject, String clientProjectId,
                                 LocalDate clientAssignmentDate) {
        this.clientAssigned = clientAssigned;
        this.clientVerified = clientVerified;
        this.clientProject = clientProject;
        this.clientProjectId = clientProjectId;
        this.clientAssignmentDate = clientAssignmentDate;
    }

    public boolean isClientAssigned() { return clientAssigned; }
    public void setClientAssigned(boolean clientAssigned) { this.clientAssigned = clientAssigned; }
    public boolean isClientVerified() { return clientVerified; }
    public void setClientVerified(boolean clientVerified) { this.clientVerified = clientVerified; }
    public String getClientProject() { return clientProject; }
    public void setClientProject(String clientProject) { this.clientProject = clientProject; }
    public String getClientProjectId() { return clientProjectId; }
    public void setClientProjectId(String clientProjectId) { this.clientProjectId = clientProjectId; }
    public LocalDate getClientAssignmentDate() { return clientAssignmentDate; }
    public void setClientAssignmentDate(LocalDate clientAssignmentDate) { this.clientAssignmentDate = clientAssignmentDate; }
}
