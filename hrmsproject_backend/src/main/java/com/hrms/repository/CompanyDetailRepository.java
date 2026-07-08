package com.hrms.repository;

import com.hrms.model.CompanyDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CompanyDetailRepository extends JpaRepository<CompanyDetail, Long> {
    Optional<CompanyDetail> findByEmployee_Id(Long employeeId);
    List<CompanyDetail> findByEmployee_IdIn(java.util.Collection<Long> ids);
    Optional<CompanyDetail> findByOryfolksId(String oryfolksId);
    Optional<CompanyDetail> findByOryfolksMailId(String oryfolksMailId);
    List<CompanyDetail> findByOryfolksIdStartingWith(String prefix);
}
