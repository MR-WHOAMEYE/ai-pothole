package com.potholeiq.repository;

import com.potholeiq.model.entity.ComplaintLog;
import com.potholeiq.model.entity.ComplaintLog.ComplaintStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ComplaintLogRepository extends JpaRepository<ComplaintLog, UUID> {

    List<ComplaintLog> findByReportId(UUID reportId);

    List<ComplaintLog> findByStatus(ComplaintStatus status);

    boolean existsByReportIdAndStatus(UUID reportId, ComplaintStatus status);
}
