package com.hrms.service;

import com.hrms.dto.ClientTimesheetWeekDTO;
import com.hrms.model.Employee;
import com.hrms.repository.ClientTimesheetRepository;
import com.hrms.repository.ClientTimesheetWeekRepository;
import com.hrms.repository.EmployeeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * An employee with no active client project cannot write a client timesheet.
 *
 * This is the half of "removal revokes access immediately" that does not depend on the
 * frontend noticing. The admin's click ends the assignment server-side; from that moment a
 * page the employee still has open — mid-edit, already loaded, sidebar still showing — must
 * not be able to save or submit through it. Hiding the sheet is presentation; this is the
 * rule.
 *
 * Reads are deliberately not blocked here: what the employee already submitted stays visible
 * to them and to the admin. Removal stops new entry, it does not erase history.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ClientTimesheetUnassignedWriteBlockTest {

    private static final Long EMP_ID = 7L;
    private static final LocalDate WEEK = LocalDate.of(2026, 6, 6); // a Saturday

    @Mock private ClientTimesheetRepository lineRepository;
    @Mock private ClientTimesheetWeekRepository weekRepository;
    @Mock private EmployeeRepository employeeRepository;
    @Mock private ClientProjectAssignmentService assignmentService;
    @Mock private ClientTimesheetNotificationService notificationService;
    @Mock private UserDisplayNameResolver userDisplayNameResolver;

    @InjectMocks private ClientTimesheetWeekService service;

    private ClientTimesheetWeekDTO payload;

    @BeforeEach
    void setUp() {
        Employee employee = new Employee();
        employee.setId(EMP_ID);
        employee.setFirstName("Dana");
        employee.setLastName("Whitfield");

        when(employeeRepository.findById(EMP_ID)).thenReturn(Optional.of(employee));
        when(lineRepository.findByEmployeeIdAndWeekStartDate(anyLong(), any())).thenReturn(Collections.emptyList());
        when(weekRepository.findByEmployeeIdAndWeekStartDate(anyLong(), any())).thenReturn(Optional.empty());

        payload = new ClientTimesheetWeekDTO();
        payload.setWeekStartDate(WEEK);
        payload.setProjectRows(Collections.emptyList());
        payload.setTimeOffRows(Collections.emptyList());
    }

    /** No active assignment → earliestAssignmentDate is null → nothing may be written. */
    private void givenRemovedFromEveryProject() {
        when(assignmentService.earliestAssignmentDate(EMP_ID)).thenReturn(null);
    }

    private void givenAnActiveAssignment() {
        when(assignmentService.earliestAssignmentDate(EMP_ID)).thenReturn(LocalDate.of(2026, 5, 27));
    }

    @Test
    void saveDraftIsRejectedOnceTheEmployeeHasBeenRemoved() {
        givenRemovedFromEveryProject();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.saveDraft(EMP_ID, payload));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertTrue(ex.getReason().toLowerCase().contains("not assigned"), ex.getReason());
    }

    @Test
    void submitIsRejectedOnceTheEmployeeHasBeenRemoved() {
        givenRemovedFromEveryProject();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.submit(EMP_ID, WEEK, payload));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
    }

    /**
     * 403 would be wrong here: the frontend's api interceptor force-logs-out on 403, and a
     * removed employee still has a perfectly valid session for the rest of HRMS.
     */
    @Test
    void theRejectionDoesNotLookLikeAnExpiredSession() {
        givenRemovedFromEveryProject();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.saveDraft(EMP_ID, payload));

        assertNotEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertNotEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
    }

    @Test
    void nothingIsPersistedWhenTheWriteIsRejected() {
        givenRemovedFromEveryProject();

        assertThrows(ResponseStatusException.class, () -> service.saveDraft(EMP_ID, payload));

        verify(lineRepository, never()).saveAll(any());
        verify(lineRepository, never()).deleteAll(any());
        verify(weekRepository, never()).save(any());
    }

    /** The block is conditional, not a wall — an assigned employee still saves normally. */
    @Test
    void anAssignedEmployeeIsNotBlocked() {
        givenAnActiveAssignment();

        assertDoesNotThrow(() -> service.saveDraft(EMP_ID, payload));
    }

    /** Re-adding restores writing, without anything else changing. */
    @Test
    void writingWorksAgainAfterTheEmployeeIsReAdded() {
        givenRemovedFromEveryProject();
        assertThrows(ResponseStatusException.class, () -> service.saveDraft(EMP_ID, payload));

        givenAnActiveAssignment();
        assertDoesNotThrow(() -> service.saveDraft(EMP_ID, payload));
    }
}
