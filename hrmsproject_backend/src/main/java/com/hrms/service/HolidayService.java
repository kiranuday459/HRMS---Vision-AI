package com.hrms.service;

import com.hrms.model.Holiday;
import com.hrms.repository.HolidayRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HolidayService {

    @Autowired
    private HolidayRepository holidayRepository;

    public List<Holiday> getAllHolidays() {
        return holidayRepository.findAll();
    }

    public List<Holiday> getHolidaysByYear(Integer year) {
        List<Holiday> holidays = holidayRepository.findByYear(year + "-%");
        if (holidays == null || holidays.isEmpty()) {
            holidays = createJapaneseHolidayDefaults(year);
        }
        return holidays;
    }

    public Holiday createHoliday(Holiday holiday) {
        return holidayRepository.save(holiday);
    }

    private List<Holiday> createJapaneseHolidayDefaults(Integer year) {
        List<Holiday> holidays = new java.util.ArrayList<>();

        holidays.add(createDefaultHoliday(year, "New Year's Day (元日)", String.format("%d-01-01", year)));
        holidays.add(createDefaultHoliday(year, "Coming of Age Day (成人の日)", String.format("%d-%02d-%02d", year, 1, getNthWeekdayOfMonth(year, 0, java.util.Calendar.MONDAY, 2))));
        holidays.add(createDefaultHoliday(year, "National Foundation Day (建国記念の日)", String.format("%d-02-11", year)));
        holidays.add(createDefaultHoliday(year, "Emperor's Birthday (天皇誕生日)", String.format("%d-02-23", year)));
        holidays.add(createDefaultHoliday(year, "Vernal Equinox Day (春分の日)", String.format("%d-03-%02d", year, getVernalEquinoxDay(year))));
        holidays.add(createDefaultHoliday(year, "Showa Day (昭和の日)", String.format("%d-04-29", year)));
        holidays.add(createDefaultHoliday(year, "Constitution Memorial Day (憲法記念日)", String.format("%d-05-03", year)));
        holidays.add(createDefaultHoliday(year, "Greenery Day (みどりの日)", String.format("%d-05-04", year)));
        holidays.add(createDefaultHoliday(year, "Children's Day (こどもの日)", String.format("%d-05-05", year)));
        holidays.add(createDefaultHoliday(year, "Marine Day (海の日)", String.format("%d-%02d-%02d", year, 7, getNthWeekdayOfMonth(year, 6, java.util.Calendar.MONDAY, 3))));
        holidays.add(createDefaultHoliday(year, "Mountain Day (山の日)", String.format("%d-08-11", year)));
        holidays.add(createDefaultHoliday(year, "Respect for the Aged Day (敬老の日)", String.format("%d-%02d-%02d", year, 9, getNthWeekdayOfMonth(year, 8, java.util.Calendar.MONDAY, 3))));
        holidays.add(createDefaultHoliday(year, "Autumnal Equinox Day (秋分の日)", String.format("%d-09-%02d", year, getAutumnalEquinoxDay(year))));
        holidays.add(createDefaultHoliday(year, "Sports Day (スポーツの日)", String.format("%d-%02d-%02d", year, 10, getNthWeekdayOfMonth(year, 9, java.util.Calendar.MONDAY, 2))));
        holidays.add(createDefaultHoliday(year, "Culture Day (文化の日)", String.format("%d-11-03", year)));
        holidays.add(createDefaultHoliday(year, "Labour Thanksgiving Day (勤労感謝の日)", String.format("%d-11-23", year)));

        for (Holiday holiday : holidays) {
            holidayRepository.save(holiday);
        }
        return holidays;
    }

    private Holiday createDefaultHoliday(Integer year, String name, String date) {
        Holiday holiday = new Holiday();
        holiday.setHolidayName(name);
        holiday.setHolidayDate(date);
        holiday.setHolidayType("Public Holiday");
        holiday.setDescription(name);
        holiday.setYear(year);
        return holiday;
    }

    private int getNthWeekdayOfMonth(int year, int month, int dayOfWeek, int nth) {
        java.util.Calendar calendar = java.util.Calendar.getInstance();
        calendar.set(year, month, 1);
        int count = 0;
        while (true) {
            if (calendar.get(java.util.Calendar.DAY_OF_WEEK) == dayOfWeek) {
                count++;
                if (count == nth) {
                    return calendar.get(java.util.Calendar.DAY_OF_MONTH);
                }
            }
            calendar.add(java.util.Calendar.DATE, 1);
        }
    }

    private int getVernalEquinoxDay(int year) {
        return (int) Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4.0));
    }

    private int getAutumnalEquinoxDay(int year) {
        return (int) Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4.0));
    }

    public Holiday updateHoliday(Long id, Holiday holidayDetails) {
        Holiday holiday = holidayRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Holiday not found with id: " + id));

        holiday.setHolidayName(holidayDetails.getHolidayName());
        holiday.setHolidayDate(holidayDetails.getHolidayDate());
        holiday.setHolidayType(holidayDetails.getHolidayType());
        holiday.setDescription(holidayDetails.getDescription());
        holiday.setYear(holidayDetails.getYear());

        return holidayRepository.save(holiday);
    }

    public void deleteHoliday(Long id) {
        holidayRepository.deleteById(id);
    }
}
