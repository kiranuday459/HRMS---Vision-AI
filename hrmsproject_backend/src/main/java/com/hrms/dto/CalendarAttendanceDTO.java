package com.hrms.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public class CalendarAttendanceDTO {
    public CalendarAttendanceDTO() {}
    
    public CalendarAttendanceDTO(Map<String, List<String>> dailyLeaves) {
        this.dailyLeaves = dailyLeaves;
    }
    private Map<String, List<String>> dailyLeaves;
    
    public Map<String, List<String>> getDailyLeaves() {
        return dailyLeaves;
    }
    public void setDailyLeaves(Map<String, List<String>> dailyLeaves) {
        this.dailyLeaves = dailyLeaves;
    }
}
