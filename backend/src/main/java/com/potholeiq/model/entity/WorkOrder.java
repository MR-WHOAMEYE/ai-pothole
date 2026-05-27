package com.potholeiq.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * WorkOrder — represents a scheduled repair assignment for a crew team.
 * Created when an admin assigns a DamageReport to a crew.
 */
@Entity
@Table(name = "work_orders", indexes = {
        @Index(name = "idx_work_order_report",    columnList = "report_id"),
        @Index(name = "idx_work_order_crew",      columnList = "assigned_crew_id"),
        @Index(name = "idx_work_order_status",    columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class WorkOrder {

    public enum WorkOrderStatus {
        PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** Foreign key reference to DamageReport.id (stored as UUID, not FK constraint for flexibility) */
    @Column(name = "report_id", nullable = false)
    private UUID reportId;

    /** UUID of the crew user (User.id with role=CREW) */
    @Column(name = "assigned_crew_id")
    private UUID assignedCrewId;

    @Column(name = "admin_id")
    private UUID adminId;

    /** Display name of the repair team */
    @Column(name = "team_name", length = 128)
    private String teamName;

    /** Ward office email address for notifications */
    @Column(name = "ward_office_email", length = 256)
    private String wardOfficeEmail;

    /** Estimated repair cost in local currency */
    @Column(name = "estimated_cost", precision = 10, scale = 2)
    private BigDecimal estimatedCost;

    /** Planned repair date */
    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    /** Timestamp when the work order was marked COMPLETED */
    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    /** Image path taken before repair work begins */
    @Column(name = "before_image_url")
    private String beforeImageUrl;

    /** Image path taken after repair is completed */
    @Column(name = "after_image_url")
    private String afterImageUrl;

    /** Crew notes / progress updates */
    @Column(name = "crew_notes", columnDefinition = "TEXT")
    private String crewNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private WorkOrderStatus status = WorkOrderStatus.PENDING;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
