package com.hrms.service;

import com.hrms.dto.ClientTimesheetDTO;
import com.hrms.model.ClientTimesheet;
import com.hrms.model.ClientTimesheetStatus;
import com.hrms.model.Employee;
import com.hrms.model.User;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * The "Reviewed by" column on the admin dashboard: each timesheet must name the admin who
 * actually reviewed <em>that</em> row.
 *
 * Worth pinning because the failure is invisible. If this ever regressed to a shared or
 * hardcoded value, every row would still render a plausible admin name and the dashboard would
 * look correct — the error only shows when someone checks who really rejected a given week,
 * which is exactly when the answer matters. Nothing else in the suite asserted this field.
 *
 * Two levels are covered: the service binding each row's own approver onto that row's DTO,
 * and the resolver turning a User into the name shown.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientTimesheetReviewerNameTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 1);

    @Mock private ClientTimesheetRepository clientTimesheetRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ClientTimesheetNotificationService notificationService;
    @Mock private ClientTimesheetEmailService clientTimesheetEmailService;

    /** Real, not mocked: the name on screen is this class's output, so stubbing it would
     *  assert nothing about what an admin actually sees. */
    private UserDisplayNameResolver resolver;

    @InjectMocks private ClientTimesheetService service;

    @BeforeEach
    void setUp() {
        resolver = new UserDisplayNameResolver();
        ReflectionTestUtils.setField(resolver, "employeeRepository", employeeRepository);
        ReflectionTestUtils.setField(service, "userDisplayNameResolver", resolver);

        // save() returns what it was handed — the DTO is built from the saved entry.
        when(clientTimesheetRepository.save(any(ClientTimesheet.class)))
                .thenAnswer(inv -> inv.getArgument(0));
    }

    /** An admin user backed by an employee record carrying their real name. */
    private User admin(Long id, String username, String first, String last) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);

        Employee record = new Employee();
        record.setId(id * 100);
        record.setFirstName(first);
        record.setLastName(last);
        when(employeeRepository.findByUser(user)).thenReturn(Optional.of(record));

        when(userRepository.findById(id)).thenReturn(Optional.of(user));
        return user;
    }

    private ClientTimesheet timesheet(Long id, String employeeFirstName) {
        Employee employee = new Employee();
        employee.setId(id * 10);
        employee.setFirstName(employeeFirstName);
        employee.setLastName("Two");

        ClientTimesheet entry = new ClientTimesheet();
        entry.setId(id);
        entry.setEmployee(employee);
        entry.setDate(WEEK_START);
        entry.setWeekStartDate(WEEK_START);
        entry.setWeekEndDate(WEEK_START.plusDays(6));
        entry.setStatus(ClientTimesheetStatus.PENDING);
        when(clientTimesheetRepository.findById(id)).thenReturn(Optional.of(entry));
        return entry;
    }

    /**
     * The case the dashboard is judged on: two admins, two timesheets, two different names.
     *
     * A single-reviewer test would pass just as happily against a hardcoded string, so the
     * distinctness is the assertion that carries the weight here.
     */
    @Test
    void eachTimesheetNamesTheAdminWhoActuallyReviewedThatRow() {
        admin(1L, "admin1", "Admin1", "User");
        admin(2L, "yasaswini", "Yasaswini", "Yallala");
        timesheet(501L, "Person");
        timesheet(502L, "Person");

        ClientTimesheetDTO first = service.reject(501L, 1L, "wrong task id");
        ClientTimesheetDTO second = service.reject(502L, 2L, "hours look duplicated");

        assertAll(
                () -> assertEquals("Admin1 User", first.getApprovedByName()),
                () -> assertEquals("Yasaswini Yallala", second.getApprovedByName()),
                () -> assertNotEquals(first.getApprovedByName(), second.getApprovedByName(),
                        "two reviewers must not collapse to one name"));
    }

    /** Approve travels the same path as reject, so it is held to the same rule. */
    @Test
    void approvalNamesItsOwnReviewerToo() {
        admin(2L, "yasaswini", "Yasaswini", "Yallala");
        timesheet(503L, "Person");

        assertEquals("Yasaswini Yallala", service.approve(503L, 2L).getApprovedByName());
    }

    /** Nobody has reviewed it yet — the column renders "—", so the name must be null, not a label. */
    @Test
    void anUnreviewedTimesheetCarriesNoReviewerName() {
        assertNull(resolver.resolve(null));
    }

    /**
     * The name is the employee record's, never the login. An admin whose account is not linked
     * to an employee falls back to the username — deliberately, since a technical handle still
     * identifies who acted, and "—" would not.
     */
    @Test
    void fallsBackToTheUsernameOnlyWhenNoEmployeeRecordExists() {
        User unlinked = new User();
        unlinked.setId(9L);
        unlinked.setUsername("admin9");
        when(employeeRepository.findByUser(unlinked)).thenReturn(Optional.empty());

        assertEquals("admin9", resolver.resolve(unlinked));
    }

    /** A missing surname must not leave a trailing space on the rendered name. */
    @Test
    void aReviewerWithNoSurnameIsNamedWithoutATrailingSpace() {
        User user = new User();
        user.setId(7L);
        user.setUsername("madhu");
        Employee record = new Employee();
        record.setFirstName("Madhu");
        record.setLastName(null);
        when(employeeRepository.findByUser(user)).thenReturn(Optional.of(record));

        assertEquals("Madhu", resolver.resolve(user));
    }
}
