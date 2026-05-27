package com.potholeiq.service;

import com.potholeiq.model.entity.ComplaintLog;
import com.potholeiq.model.entity.ComplaintLog.ComplaintStatus;
import com.potholeiq.model.entity.DamageReport;
import com.potholeiq.repository.ComplaintLogRepository;
import com.potholeiq.repository.DamageReportRepository;
import org.springframework.scheduling.annotation.Async;
import java.util.UUID;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.internet.MimeMessage;
import java.io.File;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeFormatter;

/**
 * ComplaintService — generates complaint PDFs using ephemeral temp files,
 * uploads them directly to Cloudinary, and emails them to ward offices
 * when a CRITICAL pothole is detected.
 */
@Service
public class ComplaintService {

    private static final Logger log = LoggerFactory.getLogger(ComplaintService.class);
    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Value("${complaint.ward-email:wardoffice@municipality.gov}")
    private String defaultWardEmail;

    @Value("${app.mail.from:noreply@potholeiq.com}")
    private String fromEmail;

    @Value("${app.mail.from-name:PotholeIQ}")
    private String fromName;

    private final JavaMailSender mailSender;
    private final ComplaintLogRepository complaintLogRepository;
    private final DamageReportRepository reportRepository;
    private final CloudinaryService cloudinaryService;

    public ComplaintService(JavaMailSender mailSender,
                            ComplaintLogRepository complaintLogRepository,
                            DamageReportRepository reportRepository,
                            CloudinaryService cloudinaryService) {
        this.mailSender = mailSender;
        this.complaintLogRepository = complaintLogRepository;
        this.reportRepository = reportRepository;
        this.cloudinaryService = cloudinaryService;
    }

    // ── Orchestration ─────────────────────────────────────────────────────────

    /**
     * Generates a complaint PDF and emails it to the ward office.
     * Persists a ComplaintLog entry regardless of success or failure.
     *
     * @param report    the CRITICAL DamageReport
     * @param imageUrl  Cloudinary secure URL of the scanned image
     */
    public void sendCriticalComplaint(DamageReport report, String imageUrl) {
        String pdfPath = null;
        try {
            pdfPath = generateComplaintPdf(report, imageUrl);
            String recipient = defaultWardEmail;

            // Upload the temporary PDF to Cloudinary
            File pdfFile = new File(pdfPath);
            String securePdfUrl = cloudinaryService.uploadPdf(pdfFile, report.getId().toString());

            // Send email with attachment
            sendEmailWithAttachment(report, pdfPath, recipient);

            // Update report with Cloudinary PDF URL
            report.setComplaintPdfUrl(securePdfUrl);
            report.setComplaintSent(true);

            persistLog(report.getId(), recipient, securePdfUrl, ComplaintStatus.SENT, null);
            log.info("Complaint sent for report {}", report.getId());

        } catch (Exception e) {
            log.error("Failed to send complaint for report {}: {}", report.getId(), e.getMessage(), e);
            persistLog(report.getId(), defaultWardEmail, null, ComplaintStatus.FAILED, e.getMessage());
        } finally {
            if (pdfPath != null) {
                try {
                    Files.deleteIfExists(Paths.get(pdfPath));
                } catch (Exception e) {
                    log.warn("Failed to delete temp PDF file: {}", e.getMessage());
                }
            }
        }
    }

    /**
     * Asynchronously generates a complaint PDF, uploads to Cloudinary,
     * emails it to the ward office, and saves report updates to PostgreSQL.
     */
    @Async
    public void sendCriticalComplaintAsync(DamageReport report, String imageUrl) {
        sendComplaintAsync(report, imageUrl, defaultWardEmail);
    }

    /**
     * Asynchronously generates a complaint PDF, uploads to Cloudinary,
     * emails it to the specified recipient, and saves report updates to PostgreSQL.
     */
    @Async
    public void sendComplaintAsync(DamageReport report, String imageUrl, String recipient) {
        log.info("Async: started background complaint processing for report {} targeting {}", report.getId(), recipient);
        String pdfPath = null;
        try {
            pdfPath = generateComplaintPdf(report, imageUrl);
            String targetRecipient = (recipient != null && !recipient.isBlank()) ? recipient : defaultWardEmail;

            // Upload the temporary PDF to Cloudinary
            File pdfFile = new File(pdfPath);
            String securePdfUrl = cloudinaryService.uploadPdf(pdfFile, report.getId().toString());

            // Send email with attachment
            sendEmailWithAttachment(report, pdfPath, targetRecipient);

            // Update status and details
            report.setComplaintPdfUrl(securePdfUrl);
            report.setComplaintSent(true);
            reportRepository.save(report);

            persistLog(report.getId(), targetRecipient, securePdfUrl, ComplaintStatus.SENT, null);
            log.info("Async: successfully sent complaint for report {}", report.getId());

        } catch (Exception e) {
            log.error("Async: failed to process complaint for report {}: {}", report.getId(), e.getMessage(), e);
            persistLog(report.getId(), (recipient != null && !recipient.isBlank()) ? recipient : defaultWardEmail, null, ComplaintStatus.FAILED, e.getMessage());
        } finally {
            if (pdfPath != null) {
                try {
                    Files.deleteIfExists(Paths.get(pdfPath));
                } catch (Exception e) {
                    log.warn("Failed to delete temp PDF file: {}", e.getMessage());
                }
            }
        }
    }

    /**
     * Asynchronously generates a complaint PDF, uploads to Cloudinary,
     * emails a work order assignment notification to the specified recipient,
     * and saves report updates to PostgreSQL.
     */
    @Async
    public void sendWorkOrderNotificationAsync(DamageReport report, String imageUrl, String recipient, String teamName) {
        log.info("Async: started work order notification for report {} targeting {} (crew: {})", report.getId(), recipient, teamName);
        String pdfPath = null;
        try {
            pdfPath = generateComplaintPdf(report, imageUrl);

            // Upload the temporary PDF to Cloudinary
            File pdfFile = new File(pdfPath);
            String securePdfUrl = cloudinaryService.uploadPdf(pdfFile, report.getId().toString());

            // Send work order email with attachment
            sendWorkOrderEmailWithAttachment(report, pdfPath, recipient, teamName);

            // Update status and details
            report.setComplaintPdfUrl(securePdfUrl);
            report.setComplaintSent(true);
            reportRepository.save(report);

            persistLog(report.getId(), recipient, securePdfUrl, ComplaintStatus.SENT, null);
            log.info("Async: successfully sent work order notification for report {}", report.getId());

        } catch (Exception e) {
            log.error("Async: failed to process work order notification for report {}: {}", report.getId(), e.getMessage(), e);
            persistLog(report.getId(), recipient, null, ComplaintStatus.FAILED, e.getMessage());
        } finally {
            if (pdfPath != null) {
                try {
                    Files.deleteIfExists(Paths.get(pdfPath));
                } catch (Exception e) {
                    log.warn("Failed to delete temp PDF file: {}", e.getMessage());
                }
            }
        }
    }

    // ── PDF Generation ────────────────────────────────────────────────────────

    /**
     * Generates a structured PDF complaint document using Apache PDFBox 3.x.
     * Downloads the Cloudinary image temporarily to embed it in the PDF.
     *
     * @return absolute filesystem path to the temporary PDF
     */
    public String generateComplaintPdf(DamageReport report, String imageUrl) throws Exception {
        Path tempImageFile = null;
        Path tempPdfFile = Files.createTempFile("complaint-", ".pdf");
        String pdfAbsPath = tempPdfFile.toAbsolutePath().toString();

        try {
            // Download the Cloudinary image to a temporary file for embedding
            if (imageUrl != null && !imageUrl.isEmpty()) {
                tempImageFile = Files.createTempFile("pothole-embed-", ".jpg");
                try (InputStream in = URI.create(imageUrl).toURL().openStream()) {
                    Files.copy(in, tempImageFile, StandardCopyOption.REPLACE_EXISTING);
                }
            }

            try (PDDocument doc = new PDDocument()) {
                PDPage page = new PDPage(PDRectangle.A4);
                doc.addPage(page);

                float pageWidth  = page.getMediaBox().getWidth();   // 595
                float pageHeight = page.getMediaBox().getHeight();  // 842

                PDType1Font fontBold   = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
                PDType1Font fontNormal = new PDType1Font(Standard14Fonts.FontName.HELVETICA);

                try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {

                    // ── Red header background ──────────────────────────────────────
                    cs.setNonStrokingColor(0.957f, 0.263f, 0.212f); // #F44336
                    cs.addRect(0, pageHeight - 80, pageWidth, 80);
                    cs.fill();

                    // ── Header text (white) ────────────────────────────────────────
                    cs.setNonStrokingColor(1f, 1f, 1f);
                    cs.beginText();
                    cs.setFont(fontBold, 16);
                    cs.newLineAtOffset(20, pageHeight - 35);
                    String severityStr = report.getSeverity() != null ? report.getSeverity().toUpperCase() : "CRITICAL";
                    String headerText = severityStr.equals("CRITICAL")
                            ? "** CRITICAL POTHOLE DETECTED — URGENT ACTION REQUIRED **"
                            : String.format("** %s POTHOLE DETECTED — ACTION REQUIRED **", severityStr);
                    cs.showText(headerText);
                    cs.endText();

                    cs.beginText();
                    cs.setFont(fontNormal, 11);
                    cs.newLineAtOffset(20, pageHeight - 60);
                    cs.showText("PotholeIQ Automated Complaint System");
                    cs.endText();

                    // ── Thin separator line ────────────────────────────────────────
                    cs.setStrokingColor(0.8f, 0.8f, 0.8f);
                    cs.moveTo(20, pageHeight - 90);
                    cs.lineTo(pageWidth - 20, pageHeight - 90);
                    cs.stroke();

                    // ── Report metadata ────────────────────────────────────────────
                    float yStart = pageHeight - 115;
                    float lineH  = 22;

                    cs.setNonStrokingColor(0.1f, 0.1f, 0.1f);

                    addMetaRow(cs, fontBold, fontNormal, 20, yStart,
                               "Report ID:",     report.getId().toString());
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH,
                               "Location:",      safeStr(report.getStreetAddress(), "Not available"));
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 2,
                               "Coordinates:",   safeCoords(report.getLatitude(), report.getLongitude()));
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 3,
                               "Severity:",      safeStr(report.getSeverity(), "CRITICAL"));
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 4,
                               "Priority Score:", String.format("%.1f / 100", safeDouble(report.getPriorityScore())));
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 5,
                               "Est. Depth:",    String.format("%.1f cm", safeDouble(report.getEstimatedDepthCm())));
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 6,
                               "Detected At:",   report.getDetectedAt() != null
                                                 ? report.getDetectedAt().format(FMT) : "N/A");
                    addMetaRow(cs, fontBold, fontNormal, 20, yStart - lineH * 7,
                               "Status:",        report.getStatus().name());

                    // ── Embed scanned image ───────────────────────
                    if (tempImageFile != null) {
                        float imageY = yStart - lineH * 8 - 10;
                        File imgFile = tempImageFile.toFile();
                        if (imgFile.exists() && imgFile.isFile()) {
                            try {
                                PDImageXObject img = PDImageXObject.createFromFile(imgFile.getAbsolutePath(), doc);
                                float maxImgW = pageWidth - 40;
                                float maxImgH = 200;
                                float ratio   = Math.min(maxImgW / img.getWidth(), maxImgH / img.getHeight());
                                float drawW   = img.getWidth()  * ratio;
                                float drawH   = img.getHeight() * ratio;
                                cs.drawImage(img, 20, imageY - drawH, drawW, drawH);
                            } catch (Exception imgEx) {
                                log.warn("Could not embed image in PDF: {}", imgEx.getMessage());
                            }
                        }
                    }

                    // ── Footer ─────────────────────────────────────────────────────
                    cs.setNonStrokingColor(0.5f, 0.5f, 0.5f);
                    cs.beginText();
                    cs.setFont(fontNormal, 8);
                    cs.newLineAtOffset(20, 20);
                    cs.showText("Generated by PotholeIQ — AI-Based Road Damage Assessment System");
                    cs.endText();
                }

                doc.save(pdfAbsPath);
                log.info("Complaint PDF saved to temp path: {}", pdfAbsPath);
            }
        } finally {
            if (tempImageFile != null) {
                try {
                    Files.deleteIfExists(tempImageFile);
                } catch (Exception e) {
                    log.warn("Failed to delete temp image file: {}", e.getMessage());
                }
            }
        }

        return pdfAbsPath;
    }

    // ── Email ─────────────────────────────────────────────────────────────────

    /**
     * Sends the complaint PDF as an email attachment via Brevo SMTP.
     */
    public void sendEmailWithAttachment(DamageReport report, String pdfPath, String toEmail) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(fromEmail, fromName);
        helper.setTo(toEmail);
        String severityStr = report.getSeverity() != null ? report.getSeverity().toUpperCase() : "CRITICAL";
        helper.setSubject(String.format(
                "URGENT: %s Pothole Detected — %s [Report %s]",
                severityStr,
                safeStr(report.getStreetAddress(), "Unknown Location"),
                report.getId()
        ));

        String body = buildEmailBody(report);
        helper.setText(body, true);

        // Attach PDF
        File pdfFile = new File(pdfPath);
        if (pdfFile.exists()) {
            helper.addAttachment("PotholeIQ_Complaint_" + report.getId() + ".pdf", pdfFile);
        }

        mailSender.send(message);
        log.info("Complaint email sent to {} for report {}", toEmail, report.getId());
    }

    /**
     * Sends the work order assignment email with the complaint PDF as attachment.
     */
    public void sendWorkOrderEmailWithAttachment(DamageReport report, String pdfPath, String toEmail, String teamName) throws Exception {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(fromEmail, fromName);
        helper.setTo(toEmail);
        helper.setSubject(String.format(
                "Work Order Assigned: Pothole Repair — %s [Report %s]",
                safeStr(report.getStreetAddress(), "Unknown Location"),
                report.getId()
        ));

        String body = buildWorkOrderEmailBody(report, teamName, toEmail);
        helper.setText(body, true);

        // Attach PDF
        File pdfFile = new File(pdfPath);
        if (pdfFile.exists()) {
            helper.addAttachment("PotholeIQ_Complaint_" + report.getId() + ".pdf", pdfFile);
        }

        mailSender.send(message);
        log.info("Work order email sent to {} for report {}", toEmail, report.getId());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void addMetaRow(PDPageContentStream cs,
                            PDType1Font labelFont,
                            PDType1Font valueFont,
                            float x, float y,
                            String label, String value) throws Exception {
        cs.beginText();
        cs.setFont(labelFont, 10);
        cs.newLineAtOffset(x, y);
        cs.showText(label);
        cs.setFont(valueFont, 10);
        cs.newLineAtOffset(120, 0);
        cs.showText(value);
        cs.endText();
    }

    private String buildEmailBody(DamageReport report) {
        String severity = report.getSeverity() != null ? report.getSeverity().toUpperCase() : "CRITICAL";
        String accentColor = switch (severity) {
            case "CRITICAL" -> "#EF4444";
            case "MODERATE" -> "#F59E0B";
            case "MINOR"    -> "#10B981";
            default         -> "#3B82F6";
        };

        String streetAddress = safeStr(report.getStreetAddress(), "Not available");
        String coords = safeCoords(report.getLatitude(), report.getLongitude());
        String priorityStr = String.format("%.1f / 100", safeDouble(report.getPriorityScore()));
        String depthStr = String.format("%.1f cm", safeDouble(report.getEstimatedDepthCm()));
        String detectedStr = report.getDetectedAt() != null ? report.getDetectedAt().format(FMT) : "N/A";

        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; }
                    .header { background-color: %s; padding: 30px 20px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
                    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
                    .content { padding: 30px 25px; }
                    .intro { font-size: 15px; line-height: 1.6; color: #555555; margin-bottom: 25px; }
                    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 25px; }
                    .table { width: 100%%; border-collapse: collapse; }
                    .table td { padding: 8px 0; font-size: 14px; vertical-align: top; }
                    .label { font-weight: 600; color: #475569; width: 140px; }
                    .value { color: #1e293b; }
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ffffff; background-color: %s; }
                    .footer { text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>PotholeIQ Road Damage Alert</h1>
                        <p>Automated Municipal Complaint System</p>
                    </div>
                    <div class="content">
                        <div class="intro">
                            A new <strong>%s</strong> road damage incident has been detected and logged into the PotholeIQ monitoring platform. Please inspect the details below:
                        </div>
                        <div class="card">
                            <table class="table">
                                <tr>
                                    <td class="label">Report ID</td>
                                    <td class="value" style="font-family: monospace; font-size: 13px;">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Location</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Coordinates</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Severity</td>
                                    <td class="value"><span class="badge">%s</span></td>
                                </tr>
                                <tr>
                                    <td class="label">Priority Score</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Estimated Depth</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Detected At</td>
                                    <td class="value">%s</td>
                                </tr>
                            </table>
                        </div>
                        <p class="intro" style="margin-bottom: 0;">
                            A formal engineering PDF report detailing the telemetry and visual bounding logs is attached to this email.
                        </p>
                    </div>
                    <div class="footer">
                        Generated by PotholeIQ &bull; AI-Based Road Damage Depth Assessment System
                    </div>
                </div>
            </body>
            </html>
            """,
            accentColor,
            accentColor,
            severity,
            report.getId(),
            streetAddress,
            coords,
            severity,
            priorityStr,
            depthStr,
            detectedStr
        );
    }

    private String buildWorkOrderEmailBody(DamageReport report, String teamName, String wardEmail) {
        String severity = report.getSeverity() != null ? report.getSeverity().toUpperCase() : "CRITICAL";
        String accentColor = "#3B82F6"; // Slate blue for Work Orders

        String streetAddress = safeStr(report.getStreetAddress(), "Not available");
        String coords = safeCoords(report.getLatitude(), report.getLongitude());
        String priorityStr = String.format("%.1f / 100", safeDouble(report.getPriorityScore()));
        String depthStr = String.format("%.1f cm", safeDouble(report.getEstimatedDepthCm()));
        String detectedStr = report.getDetectedAt() != null ? report.getDetectedAt().format(FMT) : "N/A";
        String severityBadgeColor = switch (severity) {
            case "CRITICAL" -> "#EF4444";
            case "MODERATE" -> "#F59E0B";
            case "MINOR"    -> "#10B981";
            default         -> "#3B82F6";
        };

        return String.format("""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f5f7; color: #333333; margin: 0; padding: 20px; }
                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e1e4e8; }
                    .header { background-color: %s; padding: 30px 20px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
                    .header p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
                    .content { padding: 30px 25px; }
                    .intro { font-size: 15px; line-height: 1.6; color: #555555; margin-bottom: 20px; }
                    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-top: 20px; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
                    .card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
                    .table { width: 100%%; border-collapse: collapse; }
                    .table td { padding: 6px 0; font-size: 14px; vertical-align: top; }
                    .label { font-weight: 600; color: #475569; width: 140px; }
                    .value { color: #1e293b; }
                    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #ffffff; background-color: %s; }
                    .footer { text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; background-color: #f8fafc; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>PotholeIQ Work Order Assigned</h1>
                        <p>Maintenance Crew Dispatch Notification</p>
                    </div>
                    <div class="content">
                        <div class="intro">
                            A repair crew has been dispatched to patch the road damage at the following location.
                        </div>
                        
                        <div class="section-title">Assignment details</div>
                        <div class="card" style="border-left: 4px solid #3B82F6;">
                            <table class="table">
                                <tr>
                                    <td class="label">Crew Assigned</td>
                                    <td class="value" style="font-weight: 700; color: #1e293b;">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Schedule Date</td>
                                    <td class="value">Pending (Dispatched immediately)</td>
                                </tr>
                                <tr>
                                    <td class="label">Ward Office</td>
                                    <td class="value">%s</td>
                                </tr>
                            </table>
                        </div>

                        <div class="section-title">Incident Details</div>
                        <div class="card">
                            <table class="table">
                                <tr>
                                    <td class="label">Report ID</td>
                                    <td class="value" style="font-family: monospace; font-size: 13px;">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Location</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Coordinates</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Severity</td>
                                    <td class="value"><span class="badge">%s</span></td>
                                </tr>
                                <tr>
                                    <td class="label">Priority Score</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Estimated Depth</td>
                                    <td class="value">%s</td>
                                </tr>
                                <tr>
                                    <td class="label">Detected At</td>
                                    <td class="value">%s</td>
                                </tr>
                            </table>
                        </div>
                        <p class="intro" style="margin-bottom: 0;">
                            A formal engineering PDF report detailing the telemetry and visual bounding logs is attached to this email.
                        </p>
                    </div>
                    <div class="footer">
                        Generated by PotholeIQ &bull; AI-Based Road Damage Depth Assessment System
                    </div>
                </div>
            </body>
            </html>
            """,
            accentColor,
            severityBadgeColor,
            teamName,
            safeStr(wardEmail, "None"),
            report.getId(),
            streetAddress,
            coords,
            severity,
            priorityStr,
            depthStr,
            detectedStr
        );
    }

    private void persistLog(java.util.UUID reportId, String recipient,
                            String pdfUrl, ComplaintStatus status, String errorMsg) {
        try {
            ComplaintLog log2 = new ComplaintLog();
            log2.setReportId(reportId);
            log2.setRecipientEmail(recipient);
            log2.setPdfUrl(pdfUrl);
            log2.setStatus(status);
            log2.setErrorMessage(errorMsg);
            complaintLogRepository.save(log2);
        } catch (Exception ex) {
            log.error("Failed to persist ComplaintLog: {}", ex.getMessage());
        }
    }

    private String safeStr(String val, String fallback) {
        return (val != null && !val.isBlank()) ? val : fallback;
    }

    private String safeCoords(Double lat, Double lng) {
        if (lat == null || lng == null) return "Not available";
        return String.format("%.5f, %.5f", lat, lng);
    }

    private double safeDouble(Double val) {
        return val != null ? val : 0.0;
    }
}

