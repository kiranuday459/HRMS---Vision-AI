package com.hrms.service;

import com.hrms.model.User;
import com.hrms.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Human-readable name for a {@link User}: the linked Employee's full name, falling back to
 * the username when no employee record is linked.
 *
 * Shared rather than reimplemented per service — three detail views now show "who did this"
 * (the timesheet approver, the week reviewer, the admin who created an assignment), and they
 * must all spell the same person the same way.
 */
@Component
public class UserDisplayNameResolver {

    @Autowired
    private EmployeeRepository employeeRepository;

    /** Null in, null out — callers render "—" for an action nobody has taken yet. */
    public String resolve(User user) {
        if (user == null) {
            return null;
        }
        return employeeRepository.findByUser(user)
                .map(e -> (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim())
                .filter(name -> !name.isEmpty())
                .orElse(user.getUsername());
    }
}
