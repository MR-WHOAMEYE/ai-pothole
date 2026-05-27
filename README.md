# PotholeIQ

PotholeIQ is an open-source production-ready backend for AI-based road damage detection, depth estimation, and municipal repair workflow management.

Built with Spring Boot 3.2, Java 17, ONNX (YOLOv8), OpenCV, and PostgreSQL/PostGIS. The service exposes REST APIs for scanning, reporting, crew management and admin analytics.

Why this README: it documents how to run locally, deploy to production (Render, Docker), the required environment variables, production caveats, contributing guidelines, and licensing for open-source use.

Table of Contents
-----------------
- Project Overview
- Quick Start (local)
- Production Deploy (Render, Docker)
- Configuration & Environment
- Storage & Model management
- Security & Operational notes
- Contributing
- License

Project Overview
----------------
PotholeIQ accepts images (mobile/scanner or single-shot), runs an ONNX-based detector and a severity classifier, stores reports in PostGIS-enabled Postgres, generates complaint PDFs for critical issues, and provides admin/crew endpoints for managing work orders.

Quick Start (local development)
-------------------------------
Prerequisites
- Java 17+
- Maven 3.9+
- PostgreSQL with PostGIS (Neon or similar)

Run locally

1. Create a `.env` at the project root with your DB and mail settings (see Configuration & Environment).
2. Place the ONNX model at either `src/main/resources/models/pothole_detector.onnx` (bundled) or `./models/pothole_detector.onnx` (runtime).
3. From the `backend` folder build and run:

```bash
cd backend
mvn spring-boot:run
# or build and run JAR
mvn clean package -DskipTests
java -jar target/potholeiq-0.0.1-SNAPSHOT.jar
```

The API listens on `http://localhost:8080` by default.

Production Deploy
-----------------
Recommended: containerized or platform deployment (Render, Railway, DigitalOcean App Platform, or a small VPS). This repo includes a `render.yaml` configured to deploy only the backend service on Render's free plan.

Render (quick)
- Ensure `render.yaml` is at repo root (present).
- On Render dashboard create a new service by connecting your GitHub repo — the `render.yaml` will configure a single Java web service that builds with `mvn clean package -DskipTests` and runs `java -jar target/potholeiq-0.0.1-SNAPSHOT.jar`.
- Add the environment variables listed in Configuration & Environment via the Render dashboard (do not upload `.env`).

Important Render caveats
- Free services sleep when idle — expect cold starts.
- Local file storage (the `uploads/` directory) is ephemeral. Use Cloudinary, S3, or other durable object storage for production uploads (the code already supports uploading complaint PDFs to Cloudinary).

Docker (recommended for predictable runtime)
1. Add a `Dockerfile` (example below) and build an image.

Example Dockerfile (recommended):

```dockerfile
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
COPY backend/ /app
RUN apt-get update && apt-get install -y libopencv-dev libopenblas-dev --no-install-recommends || true
RUN ./mvnw -f /app/pom.xml -DskipTests package || mvn -f /app/pom.xml -DskipTests package
EXPOSE 8080
CMD ["java", "-jar", "target/potholeiq-0.0.1-SNAPSHOT.jar"]
```

Place your ONNX model in `/app/models/` at runtime or bundle it into `src/main/resources/models/` before building if you prefer no runtime step.

Configuration & Environment
---------------------------
All runtime secrets and configuration must come from environment variables in production. The application supports a `.env` file for local development via `DotenvConfig`, but in prod you must set env vars in your platform.

Required env vars (important)
- `PGHOST` — Postgres host (include port if needed)
- `PGDATABASE` — Database name
- `PGUSER` — DB username
- `PGPASSWORD` — DB password
- `PGSSLMODE` — e.g. `require`
- `PGCHANNELBINDING` — e.g. `require`
- `BREVO_USER` — Brevo SMTP username
- `BREVO_API_KEY` — Brevo SMTP password / API key
- `EMAIL_FROM` — Sender address used for complaint emails

Optional / storage
- `CLOUDINARY_URL` — if using Cloudinary for PDFs/images
- `APP_UPLOAD_DIR` / `app.upload.dir` — local upload path (avoid for production)

Storage, model and persistence notes
----------------------------------
- Model: the ONNX file is required for real AI inference. If missing the app runs in STUB mode and detection returns empty results.
- Uploads: `./uploads/` is local and ephemeral on many PaaS platforms — use Cloudinary or S3 for durability.
- Database: uses Hibernate auto-ddl (`spring.jpa.hibernate.ddl-auto=update`) — suitable for rapid iteration but consider managed migrations (Flyway/Liquibase) for long-term stability.

Security & Operational Notes
---------------------------
- Replace the default admin password on first boot — a seed admin is created only if no users exist.
- Do not commit `.env` or secret keys. Use platform-native secret stores.
- Monitor JVM memory and native library usage: OpenCV and ONNX runtime can increase native memory usage.
- Configure proper logging and alerting in production.

Contributing
------------
Thank you for wanting to contribute! Recommended steps:

1. Fork the repo and create a topic branch for your change.
2. Follow code style in `src/` and add tests where appropriate.
3. Open a pull request with a clear description and testing steps.

Please open issues for feature requests or bugs and tag them clearly (bug/feature/security).

License
-------
This project is intended to be open-source. Add a license (we recommend MIT) in a `LICENSE` file to make the terms explicit.

Support & Contact
-----------------
For questions or infra help, open an issue or contact the maintainer via the email address in `application.properties` (or replace with your project contact).

Acknowledgements
----------------
- Built with Spring Boot, ONNX Runtime, OpenCV, and PostGIS.

FAQ / Troubleshooting
---------------------
Q: The server starts but detections are empty.
A: Ensure the ONNX model exists at `src/main/resources/models/pothole_detector.onnx` or `./models/pothole_detector.onnx` before startup.

Q: Uploaded images disappear after restart on Render.
A: Use Cloudinary, S3 or another durable storage provider; update `ComplaintService`/`ImageStorageService` config to offload files.

If you'd like, I can also:
- Add a `LICENSE` file (MIT) and a minimal `Dockerfile` to the repo.
- Add CI configuration for build verification (GitHub Actions).

---
_This README was generated/curated for production use and open-source collaboration._
