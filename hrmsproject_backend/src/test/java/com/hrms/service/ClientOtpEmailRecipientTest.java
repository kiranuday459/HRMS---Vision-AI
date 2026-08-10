package com.hrms.service;

import com.hrms.model.CompanyDetail;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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
 * The client-project activation OTP goes to the employee's HRMS login address, users.email —
 * the single source of truth for their corporate email — for every employee, without
 * exception.
 *
 * Three addresses exist per employee and the code has confused them before:
 *   users.email                       the login account's address        <- the only one used
 *   company_details.oryfolks_mail_id  the profile's "Corporate Email"
 *   employees.email                   the profile's "Personal Email"
 *
 * The first report was that the OTP arrived at the Personal Email. Moving it to the profile's
 * Corporate Email fixed the symptom for accounts created in one pass, where both columns are
 * seeded from the same value — but they are separate columns that nothing keeps in step, so
 * that was agreement by coincidence. These tests pin the login address itself, and the drift
 * cases below are the ones the profile field would still get wrong.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientOtpEmailRecipientTest {

    private static final Long EMP_ID = 11L;
    private static final String LOGIN = "rahulreddyravula@visionai.com";
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
        employee = employeeWith(EMP_ID, "rahul", "ravula r", LOGIN, PERSONAL, LOGIN);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed");
        when(employeeRepository.save(any(Employee.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    /** An employee carrying all three addresses, as every real row does. */
    private Employee employeeWith(Long id, String first, String last,
                                  String loginEmail, String personalEmail, String profileCorporate) {
        Employee e = new Employee();
        e.setId(id);
        e.setFirstName(first);
        e.setLastName(last);
        e.setClientProject("p8");
        e.setEmail(personalEmail);
        e.setCorporateEmail(null);      // never populated in any environment

        if (loginEmail != null) {
            User account = new User();
            account.setEmail(loginEmail);
            e.setUser(account);
        }

        CompanyDetail cd = new CompanyDetail();
        cd.setEmployee(e);
        cd.setOryfolksMailId(profileCorporate);
        when(companyDetailRepository.findByEmployee_Id(id)).thenReturn(Optional.of(cd));
        return e;
    }

    private String capturedRecipient() {
        ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendClientTimesheetOTP(to.capture(), anyString(), any(), anyString());
        return to.getValue();
    }

    // ── The rule ────────────────────────────────────────────────────────────

    @Test
    void sendsToTheLoginEmail() {
        service.issueAndSendOtp(employee);
        assertEquals(LOGIN, capturedRecipient());
    }

    /** The original report, stated directly. */
    @Test
    void neverSendsToThePersonalEmail() {
        service.issueAndSendOtp(employee);
        assertNotEquals(PERSONAL, capturedRecipient(), "OTP must not go to the Personal Email");
    }

    /**
     * The drift case. Editing "Corporate Email" on the profile rewrites
     * company_details.oryfolks_mail_id and leaves users.email alone, so the two disagree and
     * only the login address can still be signed in with.
     */
    @Test
    void ignoresTheProfileCorporateEmailWhenItHasDriftedFromTheLogin() {
        Employee drifted = employeeWith(21L, "deepika", "k",
                "deepika.k@visionai.com", "deepika@gmail.com", "deepika.old@visionai.com");

        service.issueAndSendOtp(drifted);

        assertEquals("deepika.k@visionai.com", capturedRecipient());
    }

    /**
     * The worst shape, and the one that made the profile field unsafe as a source: creating an
     * employee with Corporate Email blank seeds oryfolks_mail_id from dto.getEmail(), so the
     * profile's "Corporate Email" *is* the personal address. Reading the login skips it.
     */
    @Test
    void ignoresTheProfileCorporateEmailWhenItWasSeededWithThePersonalAddress() {
        Employee seededFromPersonal = employeeWith(22L, "nikith", "g",
                "nikith@visionai.com", "nikith@gmail.com", "nikith@gmail.com");

        service.issueAndSendOtp(seededFromPersonal);

        assertEquals("nikith@visionai.com", capturedRecipient());
    }

    /**
     * Every employee in the current database, plus the two drift shapes above. "For every
     * employee, no exceptions" is the requirement, so it is checked as a set rather than on
     * one happy-path record.
     */
    @ParameterizedTest(name = "{0}: OTP -> {1}")
    @CsvSource({
        "shalini golla,    shalini@visionai.com,    shalini@gmail.com,    shalini@visionai.com",
        "yasaswini yallala,yasaswini@visionai.com,  yasaswini@gmail.com,  yasaswini@visionai.com",
        "mounika k,        mounika@visionai.com,    mounika@gmail.com,    mounika@visionai.com",
        "yashu s,          yashuyashu@visionai.com, yashu@gmail.com,      yashuyashu@visionai.com",
        "ganesh y,         ganesh@visionai.com,     ganesh@gmail.com,     ganesh@visionai.com",
        "deepika k,        deepika.k@visionai.com,  deepika@gmail.com,    deepika.stale@visionai.com",
        "nikith g,         nikith@visionai.com,     nikith@gmail.com,     nikith@gmail.com",
        "suma y,           suma@visionai.com,       suma@gmail.com,       suma@visionai.com",
        "raviteja c,       raviteja@visionai.com,   Raviteja@gmail.com,   raviteja@visionai.com",
    })
    void alwaysLandsOnTheLoginEmail(String name, String login, String personal, String profileCorporate) {
        String[] parts = name.trim().split("\\s+", 2);
        Employee e = employeeWith(EMP_ID, parts[0], parts[1], login, personal, profileCorporate);

        service.issueAndSendOtp(e);

        String sentTo = capturedRecipient();
        assertEquals(login, sentTo);
        assertNotEquals(personal, sentTo, "OTP must never reach a personal inbox");
    }

    // ── No recipient rather than a guessed one ──────────────────────────────

    @Test
    void sendsNothingWhenTheEmployeeHasNoLoginAccount() {
        Employee noAccount = employeeWith(31L, "no", "login", null, PERSONAL, LOGIN);

        service.issueAndSendOtp(noAccount);

        verify(emailService, never()).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());
    }

    @Test
    void treatsABlankLoginAddressAsMissing() {
        Employee blank = employeeWith(32L, "blank", "mail", "   ", PERSONAL, LOGIN);

        service.issueAndSendOtp(blank);

        verify(emailService, never()).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());
    }

    /** No falling back to the profile once the login address is unusable. */
    @Test
    void doesNotFallBackToAnyProfileFieldWhenThereIsNoLogin() {
        Employee noAccount = employeeWith(33L, "no", "login", null, PERSONAL, "someone@visionai.com");

        service.issueAndSendOtp(noAccount);

        verify(emailService, never()).sendClientTimesheetOTP(anyString(), anyString(), any(), anyString());
        verifyNoInteractions(emailService);
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

    /** Issuance still happens even when there is nobody to mail it to. */
    @Test
    void stillIssuesAndStoresTheOtpWhenNoEmailCanBeSent() {
        Employee noAccount = employeeWith(34L, "no", "login", null, PERSONAL, LOGIN);

        String otp = service.issueAndSendOtp(noAccount);

        assertTrue(otp.matches("\\d{6}"));
        verify(employeeRepository).save(noAccount);
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
