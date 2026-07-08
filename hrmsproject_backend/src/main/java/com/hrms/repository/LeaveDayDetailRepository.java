package com.hrms.repository;

import com.hrms.model.LeaveDayDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface LeaveDayDetailRepository extends JpaRepository<LeaveDayDetail, Long> {
    List<LeaveDayDetail> findByLeaveId(Long leaveId);
    void deleteByLeaveId(Long leaveId);
}
