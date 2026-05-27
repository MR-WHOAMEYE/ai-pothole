# PotholeIQ — Issues Analysis & Fix Plan

## 1. CRITICAL: Backend Compilation Failure

### 1.1 Missing Metadata-Extractor GPS Package

**File:** `ExifExtractorService.java`  
**Error:** `package com.drew.metadata.gps does not exist`  
**Root Cause:** The `GpsDirectory` class IS in `com.drew.metadata.gps` in metadata-extractor 2.18.0 — the package is correct. The "package does not exist" error indicates a **dependency download failure** (Maven couldn't resolve/download the `metadata-extractor` artifact, possibly due to network issues, repo config, or offline mode).  
**Fix:** Verify Maven can reach Maven Central. Run `mvn dependency:resolve -U` to force re-download. Check for proxy/VPN issues.

### 1.2 Missing Firebase Admin SDK Dependency

**File:** `AuthController.java`, `pom.xml`  
**Error:** `cannot find symbol: FirebaseAuth.getInstance()` (implicit — will fail at compile time)  
**Root Cause:** `AuthController` imports and calls `com.google.firebase.auth.FirebaseAuth` (Firebase Admin SDK), but `pom.xml` has **no** `firebase-admin` dependency. Without it, `FirebaseAuth`, `FirebaseToken`, and all Firebase server-side auth calls will fail compilation.  
**Fix:** Add to `pom.xml`:
```xml
<dependency>
    <groupId>com.google.firebase</groupId>
    <artifactId>firebase-admin</artifactId>
    <version>9.2.0</version>
</dependency>
```
Also add a `FirebaseConfig` class that initializes the SDK with a service account JSON (from env var or file).

### 1.3 Lombok Annotation Processing

**Observation:** All entities (`DamageReport`, `User`, `WorkOrder`, `ComplaintLog`) use `@Getter`/`@Setter`/`@NoArgsConstructor` from Lombok. All DTOs use `@Data`/`@Builder`/`@NoArgsConstructor`/`@AllArgsConstructor`. The `pom.xml` correctly configures Lombok as an annotation processor. The previous build (`error.txt`) showed 100+ `cannot find symbol` errors (for methods like `getId()`, `setImageUrl()`, `builder()`). Possible causes:
- The user compiled with a Java version different from Java 17 (Lombok 1.18.46 supports Java 17-21)
- Lombok annotation processing failed due to missing `annotationProcessorPaths` config (which is already present)
- The IDE/Eclipse didn't run annotation processing
- The previous build failures cascaded: if metadata-extractor dependency failed first, subsequent compilation steps may have failed too

**Verify:** Run `mvn clean compile -DskipTests` and check if the current output is still 100+ errors or has been partially resolved.



---

## 2. CRITICAL: Security — No Authentication

### 2.1 All Endpoints Public

**File:** `SecurityConfig.java`  
**Issue:** `.permitAll()` is set on ALL endpoints — `/api/auth/**`, `/api/scanner/**`, `/api/reports/**`, `/api/admin/**`, `/api/crew/**`. There is:
- No JWT token validation
- No Firebase ID token verification
- No role-based authorization (admin vs crew vs public)
- No CSRF protection (explicitly disabled)

**Fix:** Implement a `SecurityFilter` that validates Firebase ID tokens from the `Authorization: Bearer <token>` header. Map Firebase custom claims to Spring Security roles (`ROLE_ADMIN`, `ROLE_CREW`, `ROLE_USER`). Protect endpoints appropriately:
- `/api/admin/**` → requires `ROLE_ADMIN`
- `/api/crew/**` → requires `ROLE_CREW`
- `/api/scanner/frame`, `/api/reports/upload` → requires `ROLE_USER` or authenticated public
- `/api/auth/**` → no auth

### 2.2 No Backend Token Verification

**File:** `AuthController.java`, `SecurityConfig.java`  
**Issue:** The `/api/auth/login` and `/api/auth/register` endpoints call `FirebaseAuth.getInstance().signInWithEmailAndPassword()` and `createUserWithEmailAndPassword()` — but these are **client-side Firebase SDK methods**, not server-side Admin SDK calls. The controller imports `com.google.firebase.auth.FirebaseAuth` but the actual calls reference `FirebaseAuth.getInstance()` which requires the Firebase Admin SDK, not the client SDK.

**Fix:** Either:
- Implement proper Firebase Admin SDK initialization with a service account
- Or use a simpler JWT-based auth approach with Spring Security

### 2.3 Hardcoded Firebase API Keys

**File:** `frontend/src/firebase.ts`  
**Issue:** Firebase config values are hardcoded as fallback defaults in source code:
```typescript
apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDlOtNopEAsbrNWdueTfmcyPapdMWAIAGQ",
authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "capstone-projects-bce84.firebaseapp.com",
```
These are production Firebase project credentials. While Firebase API keys are technically public (they're meant to be client-side), hardcoding them commits you to a specific Firebase project and prevents switching environments.

**Fix:** Remove the hardcoded fallback values. Use `VITE_FIREBASE_*` env vars only (without fallbacks). Create a `.env.example` file documenting all required variables.

---

## 3. HIGH: WebSocket / Real-Time Admin Feed

### 3.1 Frontend Expects WebSocket, Backend Has None

**File:** `frontend/src/hooks/useWebSocket.ts`  
**Issue:** The frontend tries to connect to a WebSocket endpoint at `/ws/admin` for real-time admin live feed. The hook falls back to HTTP polling when the connection fails. The backend has **no WebSocket configuration** — no `WebSocketConfigurer`, no `STOMP` handler, no `ServerEndpointExporter`.

**Impact:** Admin live feed never works via WebSocket; always falls back to HTTP polling, which isn't implemented either.

### 3.2 Render Free Tier Does Not Support WebSocket

**Constraint:** Render's free/paid tier does **not** support persistent WebSocket connections out of the box. WebSocket support requires a separate managed service (e.g., Ably, Pusher) or using Render's Blueprint with a WebSocket server.

**Fix:** Replace the WebSocket-based admin feed with **HTTP polling** (hit `/api/admin/dashboard/stats` on an interval) or implement **Server-Sent Events (SSE)**, which works on Render's standard HTTP infrastructure. Remove the stale WebSocket code from the frontend.

---

## 4. HIGH: Missing @Valid Annotations on Request Bodies

### 4.1 DTO Validation Audit

**Issue:** While DTOs have `jakarta.validation` annotations (`@NotNull`, `@NotBlank`, `@Email`, `@DecimalMin`, `@DecimalMax`), an audit of `@Valid` usage across controllers:

| Controller Endpoint | @RequestBody? | @Valid? | Status |
|---|---|---|---|
| `AuthController.login()` | ✅ | ✅ | OK |
| `AuthController.register()` | ✅ | ✅ | OK |
| `AuthController.googleSync()` | ✅ | ✅ | OK |
| `ScannerController.location()` | ✅ | ✅ | OK |
| `ScannerController.frame()` | MultipartFile (no DTO) | N/A | OK |
| `AdminController.assign()` | ❌ (@RequestParam) | N/A | OK |
| `AdminController.getReports()` | ❌ (@RequestParam) | N/A | OK |
| `CrewController.startWorkOrder()` | Path variable | N/A | OK |
| `CrewController.completeWorkOrder()` | MultipartFile | N/A | OK |
| `CrewController.addNotes()` | Raw String body | ❌ | **Should validate non-empty** |
| `ReportController.upload()` | MultipartFile + params | Partially | @RequestParam params not validated |

**Fix:** Add `@NotBlank` validation to `CrewController.addNotes()` request body. For multipart uploads, consider creating a DTO wrapper if parameter validation becomes necessary.

### 4.2 Missing Entity Field Validation

**Issue:** Entity classes have no `jakarta.validation` annotations on fields (e.g., `@NotNull`, `@Size`). While this is common (validation happens at the DTO layer), if entities are ever persisted directly without passing through DTOs, invalid data could be saved.

**Fix:** Add `@NotEmpty`/`@NotNull`/`@Size` constraints to entity fields where appropriate (e.g., `DamageReport.status`, `DamageReport.imageUrl`).

---

## 5. HIGH: Missing .env / Environment Configuration for Deploy

### 5.1 No Production Profile

**Issue:** Only one `application.properties` exists. No `application-production.properties` for Render deployment. Key properties that need environment-specific values:
- `spring.datasource.url` — points to localhost; needs Render PostgreSQL JDBC URL
- `spring.datasource.username/password` — hardcoded or local
- `app.upload.dir` — needs persistent storage (Render uses ephemeral filesystem)
- `app.models.dir` — ONNX model path
- `complaint.ward-email` — default fallback value hardcoded
- SMTP mail credentials (Brevo/SendGrid)

**Fix:** Create `application-production.properties` or switch to env-var-based configuration for all deploy-sensitive values. Document all required environment variables.

### 5.2 No `.env.example`

**Issue:** No `.env.example` file documenting required environment variables for either backend or frontend. Developers cannot know what to configure.

**Fix:** Create `.env.example` with documented variables for both `VITE_*` frontend vars and backend `SPRING_*` / custom vars.

---

## 6. HIGH: ONNX Model File Path

### 6.1 Model Filename Mismatch

**File:** `AiOnnxInferenceService.java`  
**Issue:** The service first tries to load `pothole_detector.onnx`, but the model file in the project is `best.onnx` (both in `src/main/resources/models/` and `target/classes/models/`).

**Impact:** The service wastes time on fallback lookups. On Render, the model path might resolve differently.

**Fix:** Update the default model filename to `best.onnx` and verify the fallback search order.

### 6.2 ONNX Model on Render

**Issue:** The ONNX model binary (~MBs) is bundled in JAR resources. On Render's ephemeral filesystem, extraction should work but the model's size could affect cold start times.

**Fix:** Consider hosting the model separately (e.g., on S3/GCS) and downloading on first boot, or ensure it's properly included in the JAR.

---

## 7. HIGH: Image Storage on Render

### 7.1 Ephemeral Filesystem Storage

**File:** `ImageStorageService.java`, `application.properties`  
**Issue:** Images are saved to `./uploads/images/` and served from the local filesystem. Render's filesystem is ephemeral — files disappear after restart and don't scale across instances.

**Fix:** Replace local filesystem storage with cloud storage (AWS S3, GCS, or Render's persistent disk). Recommended: integrate AWS S3 SDK or use Spring Cloud GCS.

### 7.2 Complaint PDF Storage

**File:** `ComplaintService.java`  
**Issue:** Same problem — complaint PDFs saved to `./uploads/complaints/` on local filesystem.

**Fix:** Same as above — move to cloud storage.

### 7.3 Static Resource Serving

**File:** `WebConfig.java`  
**Issue:** The `WebConfig` likely adds a `ResourceHandler` to serve uploads from the filesystem (e.g., `file:./uploads/`). This won't work on Render — either cloud storage URLs should be used, or Spring should serve from S3.

**Fix:** If moving to S3, serve images via presigned URLs or S3 public-read URLs. Remove file-based resource handlers for production.

---

## 8. MEDIUM: Backend Code Quality & Cleanup

### 8.1 Orphaned / Stale Files

**Files to remove (committed by accident):**
- `backend/src/App.java` — basic "Hello World" main class, clearly a placeholder
- `backend/bin/main/resources/application.properties` — duplicate of compiled resource
- `backend/bin/main/resources/META-INF/spring.factories` — compiled artifact in source
- `backend/error.txt` — Maven build failure log containing **exposed API keys/credentials** (Brevo SMTP key, Anthropic API key, Pinecone API key)
- `apiendpoint.txt` — API documentation, should be consolidated into README or removed
- `runcommand` — local dev script

### 8.2 Exposed Secrets in error.txt

**File:** `backend/error.txt`  
**CRITICAL:** This file contains:
- `ANTHROPIC_API_KEY` (base64-encoded)
- `PINECONE_API_KEY`  
- `BREVO_USER` / `BREVO_API_KEY`
- `EMAIL_FROM`

This file must be **removed from git** immediately. Add to `.gitignore` if not already. All these credentials should be rotated.

### 8.3 Broad Exception Catching

**Issue:** Many catch blocks catch `Exception` instead of specific exception types:
- `ScannerController.java` — catches `Exception` in frame processing
- `ComplaintService.java` — catches `Exception` in PDF/complaint flow
- `ReportService.java` — catches `Exception` in complaint sending
- `SeverityClassifier.java` — catches `Exception` broadly

**Fix:** Use more specific exception types. At minimum, wrap areas that legitimately throw multiple exception types with targeted catches.

### 8.4 Silent Error Swallowing

**Issue:** Some `catch` blocks log the error but return fallback values without indicating failure:
- `AiOnnxInferenceService.java` — returns `Collections.emptyList()` when inference fails
- `SeverityClassifier.java` — returns `defaultResult()` on error
- `LocationService.java` — returns fallback geocoding result

**Fix:** Consider using `Optional` return types or throwing domain-specific exceptions.

### 8.5 Missing @Transactional on Multi-Operation Methods

**File:** `ReportService.java`  
**Issue:** The `processScan()` method performs multiple repository operations (save skeleton report, update with detection data, save complaint logs) without a `@Transactional` annotation. If an intermediate step fails, data may be partially persisted.

**Fix:** Add `@Transactional` to `processScan()` and other multi-repository methods.

---

## 9. MEDIUM: Frontend TypeScript Quality

### 9.1 `any` Type Usage

**File:** `AdminMapPage.tsx` (line 42)  
**Issue:** `useState<any | null>(null)` — should use a proper interface/type.

**Fix:** Define a proper TypeScript interface for the selected report.

### 9.2 Missing Dependencies in useEffect

**Issues found:**
- `Map.tsx` uses `React.useEffect` with `[]` dependency array for initialization — correct
- `BboxCanvas.tsx` — effect depends on `bboxX`, `bboxY`, `bboxWidth`, `bboxHeight`, `imageRef`. The `imageRef` is a `RefObject` which is stable, but `ResizeObserver` is set up inside the effect without checking if it was previously set up.
- `useScanner.ts` — `captureAndUploadFrame` is a `useCallback` without dependency tracking issues visible

**Fix:** Add ESLint's `react-hooks/exhaustive-deps` rule and fix any violations.

### 9.3 Unused Imports

**Issue:** Some components may have unused React imports (in React 17+, JSX transform doesn't require `import React`). Check if `"jsx": "react-jsx"` is set in `tsconfig.json` — if so, `import React from 'react'` is unnecessary in many files but used everywhere.

**Fix:** Remove unnecessary React imports if using the new JSX transform.

---

## 10. MEDIUM: Frontend Performance

### 10.1 Missing Performance Optimizations

**Issue:** No `React.memo`, `useMemo`, or `useCallback` usage found in any component (except `useCallback` in `useScanner.ts`). This isn't critical for a v1, but for the map view with many markers and real-time scanning, it could cause unnecessary re-renders.

**Fix:** Optimize `SeverityMarker`, `ReportCard`, and map-related components with `React.memo`.

### 10.2 No Route-Level Code Splitting

**File:** `App.tsx`  
**Issue:** All pages are imported eagerly at the top. For a PWA, this means the entire app is loaded on first visit.

**Fix:** Use `React.lazy()` and `Suspense` for route-level code splitting.

---

## 11. LOW: Miscellaneous Issues

### 11.1 PostGIS Dependency on Render

**Issue:** The app uses PostGIS (`geometry(Point,4326)` column) and `hibernate-spatial`. Render's managed PostgreSQL does **not** have PostGIS enabled by default. The `CREATE EXTENSION postgis;` command must be run.

**Fix:** Document this requirement. Add a schema initialization script or Flyway migration that enables PostGIS.

### 11.2 JavaCV/OpenCV on Render

**Issue:** The app uses OpenCV via JavaCV for image preprocessing. Render uses a Linux x86_64 environment. The `pom.xml` includes `linux-x86_64` natives for OpenCV and OpenBLAS, so this should work — but JavaCV has complex native library loading that may fail.

**Fix:** Test the JavaCV/OpenCV integration on a Linux environment before deploying to Render.

### 11.3 Email Sending (Brevo/SMTP)

**File:** `ComplaintService.java`  
**Issue:** The service uses Spring's `JavaMailSender` to send complaint emails. The Brevo SMTP credentials are in `error.txt` (exposed). On Render, SMTP ports may be blocked unless using SendGrid's SMTP (port 587) or an API-based approach.

**Fix:** Document SMTP configuration for Render. Consider using SendGrid's API instead of SMTP for better reliability.

### 11.4 No Health Check Endpoint

**Issue:** Render (and most cloud platforms) requires a health check endpoint to monitor app status and restart unhealthy instances. The app has none.

**Fix:** Add Spring Boot Actuator (`/actuator/health`) or a simple custom `/api/health` endpoint that returns HTTP 200.

### 11.5 CORS Configuration Needs Production URL

**File:** `WebConfig.java`  
**Issue:** CORS is likely configured to allow `http://localhost:5173` (Vite dev server). For Render deployment, the production frontend domain must be added.

**Fix:** Make the allowed origin configurable via an environment variable (`app.cors.allowed-origins`). For production, set it to the Render frontend URL.

### 11.6 No Database Migration Tool

**Issue:** The project has no Flyway or Liquibase configuration. Schema creation relies on `spring.jpa.hibernate.ddl-auto=update`, which is risky for production (implicit schema changes, no versioning).

**Fix:** Add Flyway dependency and create a base migration (`V1__init.sql`) that creates all tables and enables PostGIS. Change `ddl-auto` to `validate` in production.

### 11.7 Mobile Responsiveness Not Verified

**Issue:** The scanner UI is designed for mobile phone cameras but no responsive design analysis was performed during this audit.

**Fix:** Review all pages for mobile layout at 375px-414px viewport widths. Ensure the scan view, map, and forms work on mobile screens.

### 11.8 frontend/src/lib/mockData.ts

**File:** `frontend/src/lib/mockData.ts`  
**Issue:** Mock data file used for development/testing. Should be documented or removed for production builds.

**Fix:** Either delete or conditionally import only in development mode.

### 11.9 Missing Index.html Meta Tags / PWA Config

**File:** `frontend/dist/index.html`  
**Issue:** The built index.html is in `dist/`. Check that the source `index.html` has proper PWA meta tags, theme-color, and service worker registration.

---

## 12. DEPLOY-READINESS CHECKLIST (Render)

- [ ] Fix compilation errors (Sections 1.x)
- [ ] Implement authentication/authorization (Section 2.x)
- [ ] Add production environment configuration `application-production.properties`
- [ ] Create `.env.example`
- [ ] Remove exposed secrets from git history (Section 8.2)
- [ ] Replace local file storage with S3/cloud storage (Section 7.x)
- [ ] Enable PostGIS extension in Render PostgreSQL (Section 11.1)
- [ ] Test JavaCV/OpenCV on Linux (Section 11.2)
- [ ] Implement WebSocket or polling fallback for admin feed (Section 3)
- [ ] Add `@Valid` annotations to all controller endpoints (Section 4)
- [ ] Verify ONNX model loads correctly (Section 6)
- [ ] Clean up orphaned files (Section 8.1)
- [ ] Configure SMTP/email for Render (Section 11.3)
- [ ] Add code splitting for production build (Section 10.2)
- [ ] Remove mock data for production (Section 11.5)
- [ ] Add missing PWA service worker registration (Section 11.9)
- [ ] Add `@Transactional` where missing (Section 8.5)
- [ ] Remove `any` types in TypeScript (Section 9.1)
- [ ] Update ONNX model filename to match actual file (Section 6.1)
- [ ] Add health check endpoint (Section 11.4)
- [ ] Configure CORS for production domain (Section 11.5)
- [ ] Add Flyway database migration tool (Section 11.6)
- [ ] Review mobile responsiveness (Section 11.7)
