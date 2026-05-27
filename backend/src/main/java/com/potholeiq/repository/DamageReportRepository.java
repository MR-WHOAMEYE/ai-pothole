package com.potholeiq.repository;

import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.model.entity.DamageReport.ReportStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface DamageReportRepository extends JpaRepository<DamageReport, UUID> {

    // ── Basic finders ──────────────────────────────────────────────────────────

    List<DamageReport> findByStatus(ReportStatus status);

    Page<DamageReport> findByStatus(ReportStatus status, Pageable pageable);

    List<DamageReport> findBySeverity(String severity);

    List<DamageReport> findByScannerSessionId(String sessionId);

    long countBySeverity(String severity);

    long countByStatus(ReportStatus status);

    // ── PostGIS spatial query: find reports within radius (metres) ─────────────
    /**
     * Uses PostGIS ST_DWithin with geography type for accurate metre-based distance.
     * Requires PostGIS extension: CREATE EXTENSION IF NOT EXISTS postgis;
     */
    @Query(value = """
            SELECT * FROM damage_reports
            WHERE geom IS NOT NULL
                        AND ST_DWithin(
                                CAST(geom AS geography),
                                CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography),
                                :radiusMeters
                        )
                        ORDER BY ST_Distance(
                                CAST(geom AS geography),
                                CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)
                        )
            """,
            nativeQuery = true)
    List<DamageReport> findNearbyWithinRadius(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusMeters") double radiusMeters
    );

    // ── Admin map-data query: filter by severity and/or status ─────────────────
    @Query("""
            SELECT d FROM DamageReport d
            WHERE d.latitude IS NOT NULL
            AND (:severity IS NULL OR d.severity = :severity)
            AND (:status   IS NULL OR d.status   = :status)
            """)
    List<DamageReport> findForMap(
            @Param("severity") String severity,
            @Param("status") ReportStatus status
    );

    // ── Heatmap aggregation: group detections by coordinate ───────────────────
    @Query(value = """
            SELECT latitude, longitude, COUNT(*) AS count
            FROM damage_reports
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            GROUP BY latitude, longitude
            """,
            nativeQuery = true)
    List<Object[]> getHeatmapAggregation();

    // ── Average response time (hours) between REPORTED → COMPLETED ────────────
    @Query(value = """
            SELECT COALESCE(
                AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600),
                0
            )
            FROM damage_reports
            WHERE status = 'COMPLETED'
            """,
            nativeQuery = true)
    Double getAvgResponseTimeHours();
}
