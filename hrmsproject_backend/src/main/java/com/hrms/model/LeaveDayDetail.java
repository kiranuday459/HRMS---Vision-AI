package com.hrms.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "leave_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeaveDayDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "leave_id", nullable = false)
    private Leave leave;

    @Column(name = "leave_date", nullable = false)
    private LocalDate leaveDate;

    @Column(name = "day_type", nullable = false)
    private String dayType; // FULL, MORNING, AFTERNOON
}
