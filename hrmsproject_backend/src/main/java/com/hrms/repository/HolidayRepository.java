package com.hrms.repository;

import com.hrms.model.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface HolidayRepository extends JpaRepository<Holiday, Long> {
    @Query("SELECT h FROM Holiday h WHERE h.holidayDate LIKE :yearPattern")
    List<Holiday> findByYear(@Param("yearPattern") String yearPattern);

    List<Holiday> findByHolidayDateBetween(String start, String end);
}
