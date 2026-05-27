package com.potholeiq.service;

import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.model.entity.DamageReport.ReportStatus;
import com.potholeiq.model.entity.WorkOrder;
import com.potholeiq.model.entity.WorkOrder.WorkOrderStatus;
import com.potholeiq.repository.DamageReportRepository;
import com.potholeiq.repository.WorkOrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * WorkOrderService — manages the full lifecycle of repair work orders.
 *
 * Lifecycle:
 *   ADMIN assigns report → WorkOrder(PENDING) + Report(ASSIGNED)
 *   Crew starts          → WorkOrder(IN_PROGRESS) + Report(IN_PROGRESS)
 *   Crew completes       → WorkOrder(COMPLETED) + Report(COMPLETED) + afterImage saved
 *   Crew adds notes      → crewNotes updated
 */
@Service
public class WorkOrderService {

    private static final Logger log = LoggerFactory.getLogger(WorkOrderService.class);

    private final WorkOrderRepository    workOrderRepository;
    private final DamageReportRepository reportRepository;
    private final CloudinaryService      cloudinaryService;
    private final ComplaintService       complaintService;

    public WorkOrderService(WorkOrderRepository    workOrderRepository,
                            DamageReportRepository reportRepository,
                            CloudinaryService      cloudinaryService,
                            ComplaintService       complaintService) {
        this.workOrderRepository = workOrderRepository;
        this.reportRepository    = reportRepository;
        this.cloudinaryService   = cloudinaryService;
        this.complaintService    = complaintService;
    }

    // ── Admin: create work order ──────────────────────────────────────────────

    /**
     * Creates a new WorkOrder and updates the linked DamageReport to ASSIGNED status.
     *
     * @param reportId  the UUID of the DamageReport being assigned
     * @param teamName  display name of the repair crew
     * @param wardEmail ward office email (for notifications, stored on the order)
     * @return the newly created WorkOrder
     */
    @Transactional
    public WorkOrder createWorkOrder(UUID reportId, String teamName, String wardEmail, String scheduledDateStr) {
        DamageReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new RuntimeException("DamageReport not found: " + reportId));

        // Delete any existing work orders for this report to prevent duplicates
        List<WorkOrder> existingOrders = workOrderRepository.findByReportId(reportId);
        if (existingOrders != null && !existingOrders.isEmpty()) {
            log.info("createWorkOrder: removing {} existing work order(s) for report {}", existingOrders.size(), reportId);
            workOrderRepository.deleteAll(existingOrders);
        }

        WorkOrder order = new WorkOrder();
        order.setReportId(reportId);
        order.setTeamName(teamName);
        order.setWardOfficeEmail(wardEmail);
        
        order.setStatus(WorkOrderStatus.PENDING);
        if (scheduledDateStr != null && !scheduledDateStr.isBlank()) {
            try {
                LocalDate schedDate = LocalDate.parse(scheduledDateStr);
                order.setScheduledDate(schedDate);
                order.setStatus(WorkOrderStatus.SCHEDULED);
            } catch (Exception e) {
                log.error("Failed to parse scheduled date: {}", scheduledDateStr, e);
            }
        }

        order.setBeforeImageUrl(report.getImageUrl()); // use original scan image as "before"
        WorkOrder saved = workOrderRepository.save(order);

        // Update report status
        report.setStatus(ReportStatus.ASSIGNED);
        reportRepository.save(report);

        log.info("WorkOrder {} created for report {} → team '{}'", saved.getId(), reportId, teamName);

        // Send formal work order notification email if wardEmail is provided
        if (wardEmail != null && !wardEmail.isBlank()) {
            log.info("createWorkOrder: dispatching formal work order notification to {}", wardEmail);
            complaintService.sendWorkOrderNotificationAsync(report, report.getImageUrl(), wardEmail, teamName);
        }

        return saved;
    }

    // ── Crew: start work ──────────────────────────────────────────────────────

    @Transactional
    public WorkOrder startWorkOrder(UUID workOrderId) {
        WorkOrder order = findOrThrow(workOrderId);
        order.setStatus(WorkOrderStatus.IN_PROGRESS);
        workOrderRepository.save(order);

        // Update linked report
        updateReportStatus(order.getReportId(), ReportStatus.IN_PROGRESS);

        log.info("WorkOrder {} started", workOrderId);
        return order;
    }

    // ── Crew: complete work ───────────────────────────────────────────────────

    @Transactional
    public WorkOrder completeWorkOrder(UUID workOrderId, MultipartFile afterImage, String completedAtStr) throws Exception {
        WorkOrder order = findOrThrow(workOrderId);

        if (afterImage != null && !afterImage.isEmpty()) {
            String afterUrl = cloudinaryService.uploadImage(afterImage.getBytes(), "potholeiq/crew/after");
            order.setAfterImageUrl(afterUrl);
        }

        order.setStatus(WorkOrderStatus.COMPLETED);
        
        if (completedAtStr != null && !completedAtStr.isBlank()) {
            try {
                order.setCompletedAt(LocalDate.parse(completedAtStr).atStartOfDay());
            } catch (Exception e) {
                log.error("Failed to parse custom completion date: {}", completedAtStr, e);
                order.setCompletedAt(LocalDateTime.now());
            }
        } else {
            order.setCompletedAt(LocalDateTime.now());
        }
        
        workOrderRepository.save(order);

        // Update linked report to COMPLETED
        updateReportStatus(order.getReportId(), ReportStatus.COMPLETED);

        log.info("WorkOrder {} completed at {}", workOrderId, order.getCompletedAt());
        return order;
    }

    // ── Crew: add notes ───────────────────────────────────────────────────────

    @Transactional
    public WorkOrder addNotes(UUID workOrderId, String notes) {
        WorkOrder order = findOrThrow(workOrderId);
        String existing = order.getCrewNotes();
        if (existing == null || existing.isBlank()) {
            order.setCrewNotes(notes);
        } else {
            // Append with timestamp separator
            order.setCrewNotes(existing + "\n\n[" + LocalDateTime.now() + "]\n" + notes);
        }
        return workOrderRepository.save(order);
    }

    // ── Crew: get assignments ─────────────────────────────────────────────────

    public List<WorkOrder> getAssignments(UUID crewId) {
        return workOrderRepository.findByAssignedCrewId(crewId);
    }

    public List<WorkOrder> getAssignmentsByEmail(String email) {
        return workOrderRepository.findByWardOfficeEmailIgnoreCase(email);
    }

    public WorkOrder getById(UUID workOrderId) {
        return findOrThrow(workOrderId);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private WorkOrder findOrThrow(UUID id) {
        return workOrderRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("WorkOrder not found: " + id));
    }

    private void updateReportStatus(UUID reportId, ReportStatus newStatus) {
        reportRepository.findById(reportId).ifPresent(r -> {
            r.setStatus(newStatus);
            reportRepository.save(r);
        });
    }
}
