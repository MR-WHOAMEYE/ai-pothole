package com.potholeiq.repository;

import com.potholeiq.model.entity.WorkOrder;
import com.potholeiq.model.entity.WorkOrder.WorkOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface WorkOrderRepository extends JpaRepository<WorkOrder, UUID> {

    List<WorkOrder> findByAssignedCrewId(UUID crewId);

    List<WorkOrder> findByReportId(UUID reportId);

    List<WorkOrder> findByStatus(WorkOrderStatus status);

    List<WorkOrder> findByWardOfficeEmailIgnoreCase(String wardOfficeEmail);

    long countByStatus(WorkOrderStatus status);
}
