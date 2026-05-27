# PotholeIQ — AI-Based Road Damage Depth Assessment & Municipal Priority Repair Management System

> Spring Boot 3.2 · Java 17 · YOLOv8 ONNX · OpenCV · PostGIS · Brevo SMTP

---

## Quick Start

### 1. Prerequisites

| Tool        | Version  |
|-------------|----------|
| Java        | 17+      |
| Maven       | 3.9+     |
| PostgreSQL  | Neon DB (already configured) |

---

### 2. Configure `.env`

The `.env` file at the project root is already created with your Neon DB and Brevo credentials.  
**Complete your Brevo API key** — the `BREVO_API_KEY` field requires the full key from your Brevo dashboard:

```
PGHOST=ep-long-lab-ap4er6mg.c-7.us-east-1.aws.neon.tech
PGDATABASE=neondb
PGUSER=neondb_owner
PGPASSWORD=my passwd
PGSSLMODE=require
PGCHANNELBINDING=require

BREVO_USER=aad072001@smtp-brevo.com
BREVO_API_KEY=xsmtpsib-<YOUR_FULL_KEY_HERE>
EMAIL_FROM=fun291167@gmail.com
```

> ⚠️ **Never commit `.env` to version control.** It is already listed in `.gitignore`.

---

### 3. PostGIS Extension (Already Done ✅)

The `postgis` extension is already enabled on your Neon database.

---

### 4. Place the YOLOv8 ONNX Model

The AI inference service looks for the model in two locations (first found wins):

**Option A — Classpath (bundled in JAR):**
```
src/main/resources/models/pothole_detector.onnx
```

**Option B — Runtime directory (no rebuild needed):**
```
./models/pothole_detector.onnx
```
Create the `models/` directory next to where you run the JAR and drop the file there.

> If neither location has the model, the app starts in **STUB mode** — all endpoints work but AI detection returns empty results. A warning is logged on startup.

**Export your model from Ultralytics:**
```bash
yolo export model=best.pt format=onnx imgsz=640
```

---

### 5. Run the Application

```bash
# Development
mvn spring-boot:run

# Or build and run the JAR
mvn clean package -DskipTests
java -jar target/potholeiq-0.0.1-SNAPSHOT.jar
```

The server starts on **http://localhost:8080**

---

### 6. Tables Auto-Created

`spring.jpa.hibernate.ddl-auto=update` means Hibernate automatically creates or updates all tables on first run. **No migration scripts needed.**

Tables created:
- `damage_report`
- `work_order`
- `app_user`
- `complaint_log`

---

### 7. Default Admin Account

Created automatically on first run if no users exist:

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@potholeiq.com    |
| Password | admin123               |
| Role     | ADMIN                  |

> ⚠️ Change this password before production deployment.

---

## API Reference

### Scanner (Real-time)

| Method | Path                     | Description                                  |
|--------|--------------------------|----------------------------------------------|
| POST   | `/api/scanner/frame`     | Upload frame → AI detect → classify → notify |
| POST   | `/api/scanner/location`  | Supply GPS for a pending report              |

**Example — upload frame with GPS:**
```bash
curl -X POST http://localhost:8080/api/scanner/frame \
  -F "image=@/path/to/photo.jpg" \
  -F "sessionId=mobile-session-001" \
  -F "lat=12.9716" \
  -F "lng=77.5946"
```

**Example — upload without GPS (returns 202):**
```bash
# Step 1
curl -X POST http://localhost:8080/api/scanner/frame \
  -F "image=@/path/to/photo.jpg" \
  -F "sessionId=s002"
# Response: { "locationRequired": true, "reportId": "uuid-here" }

# Step 2 — supply location
curl -X POST "http://localhost:8080/api/scanner/location?reportId=uuid-here" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 12.9716, "longitude": 77.5946}'
```

---

### Reports (Community)

| Method | Path                               | Description               |
|--------|------------------------------------|---------------------------|
| POST   | `/api/reports/upload`              | Single-shot image upload  |
| GET    | `/api/reports/{id}`                | Get report by ID          |
| GET    | `/api/reports/nearby`              | PostGIS radius search     |
| GET    | `/api/reports/my-reports`          | User's reports            |

**Nearby search:**
```bash
curl "http://localhost:8080/api/reports/nearby?lat=12.9716&lng=77.5946&radiusMeters=500"
```

---

### Admin Dashboard

| Method | Path                        | Description                     |
|--------|-----------------------------|---------------------------------|
| GET    | `/api/admin/map-data`       | GeoJSON FeatureCollection       |
| GET    | `/api/admin/heatmap`        | Lat/lng/count aggregates        |
| POST   | `/api/admin/assign`         | Create work order               |
| GET    | `/api/admin/dashboard/stats`| Counts and avg response time    |
| GET    | `/api/admin/reports`        | Paginated filtered report list  |

**Dashboard stats:**
```bash
curl http://localhost:8080/api/admin/dashboard/stats
```

**Map data (filter by severity):**
```bash
curl "http://localhost:8080/api/admin/map-data?severity=CRITICAL&status=REPORTED"
```

**Assign to crew:**
```bash
curl -X POST "http://localhost:8080/api/admin/assign?reportId=<uuid>&teamName=Team+Alpha&wardEmail=ward1@gov.in"
```

---

### Crew Management

| Method | Path                               | Description                     |
|--------|------------------------------------|---------------------------------|
| GET    | `/api/crew/assignments`            | Get assigned work orders        |
| POST   | `/api/crew/workorders/{id}/start`  | Mark IN_PROGRESS                |
| POST   | `/api/crew/workorders/{id}/complete`| Upload after-photo + COMPLETED |
| POST   | `/api/crew/workorders/{id}/notes`  | Append progress notes           |

---

## Project Structure

```
src/main/java/com/potholeiq/
├── config/
│   ├── DotenvConfig.java          ← .env loader (runs before Spring wires beans)
│   ├── SecurityConfig.java        ← Permit-all + BCrypt
│   └── WebConfig.java             ← CORS + static uploads
├── controller/
│   ├── ScannerController.java
│   ├── ReportController.java
│   ├── AdminController.java
│   └── CrewController.java
├── dto/                           ← Request/Response transfer objects
├── exception/
│   └── GlobalExceptionHandler.java
├── model/entity/                  ← JPA entities (DamageReport, WorkOrder, User, ComplaintLog)
├── repository/                    ← Spring Data JPA + PostGIS native queries
├── service/
│   ├── AiOnnxInferenceService.java   ← YOLOv8 inference
│   ├── SeverityClassifier.java       ← OpenCV Laplacian + OTSU scoring
│   ├── LocationService.java          ← Nominatim geocoding
│   ├── ComplaintService.java         ← PDF generation + Brevo email
│   ├── ReportService.java            ← Main scan pipeline orchestrator
│   ├── WorkOrderService.java         ← Crew lifecycle management
│   ├── ImageStorageService.java      ← File save to ./uploads/
│   └── ExifExtractorService.java     ← GPS EXIF extraction
└── PotholeiqApplication.java         ← Main class + admin seed runner
```

---

## Severity Classification Logic

| Metric                   | Weight | Method                              |
|--------------------------|--------|-------------------------------------|
| Surface roughness        | 35%    | Laplacian filter standard deviation |
| Shadow/cavity depth      | 35%    | OTSU thresholding + dark pixel ratio|
| Physical size            | 30%    | Bbox area / image area              |

| Score    | Level    | Color     | Est. Depth  |
|----------|----------|-----------|-------------|
| < 35     | MINOR    | `#4CAF50` | 1–3 cm      |
| 35–60    | MODERATE | `#FFC107` | 3–8 cm      |
| > 60     | CRITICAL | `#F44336` | 8–20 cm     |

CRITICAL reports automatically trigger:
1. PDF complaint generation (saved to `./uploads/complaints/`)
2. Email to ward office via Brevo SMTP

---

## Environment Variables Reference

| Variable           | Maps To                          |
|--------------------|----------------------------------|
| `PGHOST`           | `spring.datasource.url` (host)   |
| `PGDATABASE`       | `spring.datasource.url` (db)     |
| `PGUSER`           | `spring.datasource.username`     |
| `PGPASSWORD`       | `spring.datasource.password`     |
| `PGSSLMODE`        | SSL mode in JDBC URL             |
| `BREVO_USER`       | `spring.mail.username`           |
| `BREVO_API_KEY`    | `spring.mail.password`           |
| `EMAIL_FROM`       | Sender address in complaint mails|

> On **Render**, set these as Environment Variables in the dashboard instead of `.env`.
> `DotenvConfig` checks OS env vars as a fallback when `.env` is missing.
