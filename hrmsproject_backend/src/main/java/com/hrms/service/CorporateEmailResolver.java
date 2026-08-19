package com.hrms.service;

import com.hrms.model.Employee;
import com.hrms.model.User;
import org.springframework.stereotype.Component;

/**
 * The one place that decides where a Client Timesheet email is sent: the address on the
 * recipient's HRMS login account, users.email.
 *
 * This is the rule the activation OTP was fixed to follow, lifted out of
 * {@link ClientVerificationService} so the rejection email and the two scheduled reminders
 * cannot drift from it. Every one of them now reads the same method — there is no second
 * email-source lookup to keep in step.
 *
 * It deliberately reads no profile field. Three addresses exist per employee and the code
 * has confused them before:
 *   users.email                       the login account's address        <- the only one used
 *   company_details.oryfolks_mail_id  the profile's "Corporate Email"
 *   employees.email                   the profile's "Personal Email"
 * The profile's "Corporate Email" is a separate column that merely happens to be seeded from
 * the same value when an account is created alongside the employee, and drifts afterwards:
 * EmployeeService seeds it with the *personal* address when the create form leaves it blank,
 * editing it on the profile never touches users.email, and AdminUserController creates logins
 * with an address of their own. Each of those routes points mail at an inbox the employee does
 * not sign in with. Reading the login makes that unreachable by construction rather than by
 * data hygiene.
 *
 * Null when there is no login account or its address is blank. Callers skip the send rather
 * than guessing a fallback — no address is better than the wrong person's inbox.
 */
@Component
public class CorporateEmailResolver {

    /** The employee's login address, or null when they have no usable login account. */
    public String resolve(Employee employee) {
        return employee == null ? null : resolve(employee.getUser());
    }

    /** The account's own address — used directly for admin recipients, who have no employee row of interest. */
    public String resolve(User account) {
        if (account == null) {
            return null;
        }
        String login = account.getEmail();
        return login != null && !login.isBlank() ? login : null;
    }
}
