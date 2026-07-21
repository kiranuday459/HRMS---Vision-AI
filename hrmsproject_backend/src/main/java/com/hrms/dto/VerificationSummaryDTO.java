package com.hrms.dto;

/** Counts for the admin dashboard "Client Project Access" widget. */
public class VerificationSummaryDTO {

    private long totalAssigned;
    private long totalVerified;
    private long totalPendingVerification;

    public VerificationSummaryDTO() {}

    public VerificationSummaryDTO(long totalAssigned, long totalVerified, long totalPendingVerification) {
        this.totalAssigned = totalAssigned;
        this.totalVerified = totalVerified;
        this.totalPendingVerification = totalPendingVerification;
    }

    public long getTotalAssigned() { return totalAssigned; }
    public void setTotalAssigned(long totalAssigned) { this.totalAssigned = totalAssigned; }
    public long getTotalVerified() { return totalVerified; }
    public void setTotalVerified(long totalVerified) { this.totalVerified = totalVerified; }
    public long getTotalPendingVerification() { return totalPendingVerification; }
    public void setTotalPendingVerification(long totalPendingVerification) { this.totalPendingVerification = totalPendingVerification; }
}
