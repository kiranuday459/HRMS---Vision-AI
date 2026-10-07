package com.hrms.repository;

import com.hrms.model.DeletedEmployee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeletedEmployeeRepository extends JpaRepository<DeletedEmployee, Long> {

    /** Returns all deleted-employee snapshots, newest first. */
    List<DeletedEmployee> findAllByOrderByDeletedAtDesc();
}
