package com.potholeiq.controller;

import com.potholeiq.model.entity.WorkOrder;
import com.potholeiq.service.WorkOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/**
 * CrewController — endpoints for repair crew members to manage their assigned work orders.
 *
 * Crew workflow:
 *   1. GET  /api/crew/assignments            — view assigned work orders
 *   2. POST /api/crew/workorders/{id}/start  — mark order as IN_PROGRESS
 *   3. POST /api/crew/workorders/{id}/notes  — log progress notes
 *   4. POST /api/crew/workorders/{id}/complete — upload after-image and mark COMPLETED
 */
@RestController
@RequestMapping("/api/crew")
public class CrewController {

    private static final Logger log = LoggerFactory.getLogger(CrewController.class);

    private final WorkOrderService workOrderService;

    public CrewController(WorkOrderService workOrderService) {
        this.workOrderService = workOrderService;
    }

    /**
     * GET /api/crew/assignments
     *
     * Returns all work orders assigned to a specific crew member.
     */
    @GetMapping("/assignments")
    public ResponseEntity<List<WorkOrder>> getAssignments(
            @RequestParam(required = false) UUID crewId,
            @RequestParam(required = false) String email
    ) {
        log.debug("GET /api/crew/assignments crewId={}, email={}", crewId, email);
        List<WorkOrder> orders;
        if (email != null && !email.isBlank()) {
            orders = workOrderService.getAssignmentsByEmail(email);
        } else if (crewId != null) {
            orders = workOrderService.getAssignments(crewId);
        } else {
            orders = List.of();
        }
        return ResponseEntity.ok(orders);
    }

    /**
     * POST /api/crew/workorders/{id}/start
     *
     * Marks a work order as IN_PROGRESS and updates the linked DamageReport accordingly.
     */
    @PostMapping("/workorders/{id}/start")
    public ResponseEntity<WorkOrder> startWorkOrder(@PathVariable UUID id) {
        log.info("POST /api/crew/workorders/{}/start", id);
        try {
            WorkOrder order = workOrderService.startWorkOrder(id);
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            log.warn("Start work order failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * POST /api/crew/workorders/{id}/complete
     *
     * Marks a work order as COMPLETED. Optionally accepts an "after" image
     * documenting the completed repair.
     */
    @PostMapping(value = "/workorders/{id}/complete", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<WorkOrder> completeWorkOrder(
            @PathVariable UUID id,
            @RequestPart(value = "afterImage", required = false) MultipartFile afterImage,
            @RequestParam(required = false, defaultValue = "") String completedAtStr
    ) {
        log.info("POST /api/crew/workorders/{}/complete completedAtStr={}", id, completedAtStr);
        try {
            WorkOrder order = workOrderService.completeWorkOrder(id, afterImage, completedAtStr);
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            log.warn("Complete work order failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Complete work order error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * POST /api/crew/workorders/{id}/notes
     *
     * Appends crew progress notes to a work order (timestamped).
     * Send notes as a plain text request body.
     */
    @PostMapping(value = "/workorders/{id}/notes",
                 consumes = {MediaType.TEXT_PLAIN_VALUE, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<WorkOrder> addNotes(
            @PathVariable UUID id,
            @RequestBody   String notes
    ) {
        log.debug("POST /api/crew/workorders/{}/notes", id);
        try {
            WorkOrder order = workOrderService.addNotes(id, notes);
            return ResponseEntity.ok(order);
        } catch (RuntimeException e) {
            log.warn("Add notes failed: {}", e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * GET /api/crew/workorders/{id}
     *
     * Retrieve a single work order by ID.
     */
    @GetMapping("/workorders/{id}")
    public ResponseEntity<WorkOrder> getWorkOrder(@PathVariable UUID id) {
        try {
            return ResponseEntity.ok(workOrderService.getById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
