package com.hrms.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "holidays")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Holiday {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "holiday_name")
    private String holidayName;

    @Column(name = "holiday_date")
    private String holidayDate; // Format: YYYY-MM-DD

    @Column(name = "description")
    private String description;

    @Column(name = "holiday_type")
    private String holidayType;

    @Column(name = "\"year\"")
    private Integer year;

    @PrePersist
    @PreUpdate
    public void ensureDefaults() {
        if (holidayDate != null && holidayDate.length() >= 4) {
            try {
                if (this.year == null) {
                    this.year = Integer.parseInt(holidayDate.substring(0, 4));
                }
            } catch (NumberFormatException e) {
                // Ignore
            }
        }
        if (this.holidayType == null) {
            this.holidayType = "General";
        }
        if (this.description == null) {
            this.description = holidayName;
        }
    }
}
