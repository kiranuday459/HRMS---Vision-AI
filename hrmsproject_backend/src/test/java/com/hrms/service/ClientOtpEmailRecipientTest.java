package com.hrms.service;

import com.hrms.model.CompanyDetail;
import com.hrms.model.Employee;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * The client-project activation OTP goes to the employee's Corporate Email.
 *
 * The reported bug: it was arriving at the Personal Email. The Corporate Email shown on the
 * Personal Details page is company_details.oryfolks_mail_id, but resolveEmail() read
 * employees.corporate_email — a different column that is never populated — so it always fell
 * through to employee.email, the personal address. These tests use the exact shape of the
 * reported record: both addresses on file, corporate held on the company detail.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientOtpEmailRecipientTest {

    private static final Long EMP_ID = 11L;
    private static final String CORPORATE = "rahulreddyravula@visionai.com";
    private static final String PERSONAL = "rahul@gmail.com";

    @Mock private EmployeeRepository employeeRepository;
    @Mock private CompanyDetailRepository companyDetailRepository;
    @Mock private EmailService emailService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ClientTimesheetNotificationService notificationService;

    @InjectMocks private ClientVerificationService service;

    private Employee employee;

    @BeforeEach
    void setUp() {
        employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("rahul");
        employee.setLastName("ravula r");
        employee.setClientProject("p8");
        employee.setEmail(PERSONAL);              // Personal Email on the profile
        employee.setCorporateEmail(null);         // the unpopulated column resolveEmail used to read

        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(employeeRepository.save(any(Employee.class))).thenAnswer(inv -> inv.getArgument(0));
        givenCompanyDetailMail(CORPORATE);
    }

    private void givenCompanyDetailMail(String mail) {
        CompanyDetail cd = new CompanyDetail();
        cd.setEmployee(employee);
        cd.setOryfolksMailId(mail);
        when(companyDetailRepository.findByEmployee_Id(EMP_ID)).thenReturn(Optional.of(cd));
    }

    private String capturedRecipient() {
        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendClientTimesheetOTP(to.capture(), anyString(), any(), anyString());
        return to.getValue();
    }

    @Test
    void sendsToTheCorporateEmailFromTheCompanyDetail() {
        service.issueAndSendOtp(employee);
        assertEquals(CORPORATE, capturedRecipient());
    }

    /** The bug, stated directly. */
    @Test
    void neverSendsToThePersonalEmail() {
        service.issueAndSendOtp(employee);
        assertNotEquals(PERSONAL, capturedRecipient(), "OTP must not go to the Personal Email");
    }

    @Test
    void doesNotFallBackToPersonalWhenNoCorporateIsOnFile() {
        when(companyDetailRepository.findByEmployee_Id(EMP_ID)).thenReturn(Optional.empty());

        service.issueAndSendOtp(employee);

        verify(emailService, never()).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());
    }

    @Test
    void treatsABlankCorporateAddressAsMissing() {
        givenCompanyDetailMail("   ");

        service.issueAndSendOtp(employee);

        verify(emailService, never()).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());
    }

    // ── Everything below must be unchanged by this fix ──────────────────────

    @Test
    void stillIssuesASixDigitOtpAndSavesIt() {
        String otp = service.issueAndSendOtp(employee);

        assertNotNull(otp);
        assertTrue(otp.matches("\\d{6}"), "expected a 6-digit OTP, got: " + otp);
        verify(passwordEncoder).encode(otp);      // stored hashed, not in clear
        verify(employeeRepository).save(employee);
    }

    @Test
    void stillPassesTheAssignedProjectAndEmployeeNameToTheTemplate() {
        ArgumentCaptor<String> name = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> project = ArgumentCaptor.forClass(String.class);

        service.issueAndSendOtp(employee);

        verify(emailService).sendClientTimesheetOTP(anyString(), name.capture(), project.capture(), anyString());
        assertEquals("rahul ravula r", name.getValue());
        assertEquals("p8", project.getValue());
    }

    /** A mail failure must still never roll back the OTP issuance. */
    @Test
    void stillSurvivesAMailFailure() {
        doThrow(new RuntimeException("SMTP down"))
                .when(emailService).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());

        assertDoesNotThrow(() -> service.issueAndSendOtp(employee));
    }
}
