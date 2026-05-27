package com.potholeiq.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * ComplaintLog — audit trail for every automated complaint notification sent
 * (or attempted) to a ward office regarding a CRITICAL pothole.
 */
@Entity
@Table(name = "complaint_logs", indexes = {
        @Index(name = "idx_complaint_report", columnList = "report_id"),
        @Index(name = "idx_complaint_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
public class ComplaintLog {

    public enum ComplaintStatus {
        SENT, FAILED, BOUNCED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    /** The DamageReport this complaint was generated for */
    @Column(name = "report_id", nullable = false)
    private UUID reportId;

    /** Email address the complaint was sent to */
    @Column(name = "recipient_email", length = 256)
    private String recipientEmail;

    /** Relative path to the saved complaint PDF */
    @Column(name = "pdf_url")
    private String pdfUrl;

    /** When the email was sent (or attempted) */
    @Column(name = "sent_at")
    private LocalDateTime sentAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ComplaintStatus status;

    /** Optional error message for FAILED/BOUNCED status */
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @PrePersist
    protected void onCreate() {
        if (sentAt == null) {
            sentAt = LocalDateTime.now();
        }
    }
}
