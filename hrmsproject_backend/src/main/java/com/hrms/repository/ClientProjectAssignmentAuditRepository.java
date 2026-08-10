package com.hrms.repository;

import com.hrms.model.ClientProjectAssignmentAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClientProjectAssignmentAuditRepository extends JpaRepository<ClientProjectAssignmentAudit, Long> {

    /**
     * Newest first — the Audit Logs tab reads most-recent-at-the-top and does no sorting of
     * its own. Id breaks ties, so several rows written in the same batch (one assign action
     * covering a dozen employees shares a timestamp) still come back in a stable order.
     */
    List<ClientProjectAssignmentAudit> findAllByOrderByPerformedAtDescIdDesc();
}
