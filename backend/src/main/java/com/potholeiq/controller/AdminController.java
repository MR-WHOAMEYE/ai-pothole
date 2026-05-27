package com.potholeiq.controller;

import com.potholeiq.dto.GeoJsonFeature;
import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.model.entity.DamageReport.ReportStatus;
import com.potholeiq.model.entity.WorkOrder;
import com.potholeiq.repository.DamageReportRepository;
import com.potholeiq.service.WorkOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * AdminController — municipal admin dashboard endpoints.
 *
 * Provides map data (GeoJSON), heatmap aggregates, work order assignment,
 * dashboard stats, and paginated report management.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);

    private final DamageReportRepository reportRepository;
    private final WorkOrderService       workOrderService;
    private final com.potholeiq.repository.WorkOrderRepository workOrderRepository;

    public AdminController(DamageReportRepository reportRepository,
                           WorkOrderService workOrderService,
                           com.potholeiq.repository.WorkOrderRepository workOrderRepository) {
        this.reportRepository = reportRepository;
        this.workOrderService = workOrderService;
        this.workOrderRepository = workOrderRepository;
    }

    /**
     * GET /api/admin/map-data?severity=&status=
     *
     * Returns a GeoJSON FeatureCollection of all reports matching the filters.
     * Each Feature includes: id, severity, status, address, priority score, hex colour.
     */
    @GetMapping("/map-data")
    public ResponseEntity<Map<String, Object>> getMapData(
            @RequestParam(required = false) String severity,
            @RequestParam(required = false) String status
    ) {
        ReportStatus parsedStatus = null;
        if (status != null && !status.isBlank()) {
            try { parsedStatus = ReportStatus.valueOf(status.toUpperCase()); }
            catch (IllegalArgumentException e) { /* ignore invalid status */ }
        }

        List<DamageReport> reports = reportRepository.findForMap(
                severity != null && !severity.isBlank() ? severity.toUpperCase() : null,
                parsedStatus
        );

        List<GeoJsonFeature> features = new ArrayList<>();
        for (DamageReport r : reports) {
            if (r.getLatitude() == null || r.getLongitude() == null) continue;
            features.add(GeoJsonFeature.of(
                    r.getId().toString(),
                    r.getLatitude(),
                    r.getLongitude(),
                    r.getSeverity()  != null ? r.getSeverity() : "UNKNOWN",
                    r.getStatus().name(),
                    r.getStreetAddress() != null ? r.getStreetAddress() : "",
                    r.getPriorityScore() != null ? r.getPriorityScore() : 0.0,
                    severityColor(r.getSeverity())
            ));
        }

        Map<String, Object> featureCollection = new LinkedHashMap<>();
        featureCollection.put("type", "FeatureCollection");
        featureCollection.put("features", features);

        return ResponseEntity.ok(featureCollection);
    }

    /**
     * GET /api/admin/heatmap
     *
     * Returns aggregated lat/lng/count for rendering a heatmap layer.
     */
    @GetMapping("/heatmap")
    public ResponseEntity<List<Map<String, Object>>> getHeatmap() {
        List<Object[]> raw = reportRepository.getHeatmapAggregation();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Object[] row : raw) {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("lat",   row[0]);
            point.put("lng",   row[1]);
            point.put("count", row[2]);
            result.add(point);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * POST /api/admin/assign?reportId=&teamName=&wardEmail=
     *
     * Creates a WorkOrder assigning a repair team to a detected pothole report.
     */
    @PostMapping("/assign")
    public ResponseEntity<WorkOrder> assignReport(
            @RequestParam UUID   reportId,
            @RequestParam String teamName,
            @RequestParam(required = false, defaultValue = "") String wardEmail,
            @RequestParam(required = false, defaultValue = "") String scheduledDate
    ) {
        log.info("Assigning report {} to team '{}', scheduledDate: {}", reportId, teamName, scheduledDate);
        WorkOrder order = workOrderService.createWorkOrder(reportId, teamName, wardEmail, scheduledDate);
        return ResponseEntity.ok(order);
    }

    /**
     * GET /api/admin/dashboard/stats
     *
     * Returns key metrics for the admin overview dashboard.
     */
    @GetMapping("/dashboard/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        long total     = reportRepository.count();
        long pending   = reportRepository.countByStatus(ReportStatus.REPORTED)
                       + reportRepository.countByStatus(ReportStatus.VERIFIED);
        long completed = reportRepository.countByStatus(ReportStatus.COMPLETED);
        long critical  = reportRepository.countBySeverity("CRITICAL");
        Double avgTime = reportRepository.getAvgResponseTimeHours();

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total",           total);
        stats.put("pending",         pending);
        stats.put("completed",       completed);
        stats.put("critical",        critical);
        stats.put("avgResponseTimeH", avgTime != null ? Math.round(avgTime * 10.0) / 10.0 : 0.0);

        return ResponseEntity.ok(stats);
    }

    /**
     * GET /api/admin/reports?status=&page=&size=
     *
     * Paginated, optionally filtered list of all reports for admin review.
     */
    @GetMapping("/reports")
    public ResponseEntity<Page<DamageReport>> getReports(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        PageRequest pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<DamageReport> results;
        if (status != null && !status.isBlank()) {
            try {
                ReportStatus rs = ReportStatus.valueOf(status.toUpperCase());
                results = reportRepository.findByStatus(rs, pageable);
            } catch (IllegalArgumentException e) {
                results = reportRepository.findAll(pageable);
            }
        } else {
            results = reportRepository.findAll(pageable);
        }

        return ResponseEntity.ok(results);
    }

    /**
     * GET /api/admin/reports/{reportId}/workorder
     *
     * Retrieve the work order assigned to a specific report.
     */
    @GetMapping("/reports/{reportId}/workorder")
    public ResponseEntity<WorkOrder> getWorkOrderForReport(@PathVariable UUID reportId) {
        List<WorkOrder> orders = workOrderRepository.findByReportId(reportId);
        if (orders.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(orders.get(0));
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String severityColor(String severity) {
        if (severity == null) return "#9E9E9E";
        return switch (severity.toUpperCase()) {
            case "CRITICAL" -> "#F44336";
            case "MODERATE" -> "#FFC107";
            case "MINOR"    -> "#4CAF50";
            default         -> "#9E9E9E";
        };
    }
}
