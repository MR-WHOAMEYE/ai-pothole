## Multi-stage Dockerfile for PotholeIQ backend
## Stage 1: build with Maven
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
# Copy the backend sources
COPY backend /build
RUN mvn -f /build/pom.xml -DskipTests clean package

## Stage 2: runtime image
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app
# Create directories for models and uploads (runtime mount-friendly)
RUN mkdir -p /app/models /app/uploads
# Copy JAR from build stage
COPY --from=builder /build/target/potholeiq-0.0.1-SNAPSHOT.jar /app/potholeiq.jar

EXPOSE 8080
ENV JAVA_OPTS="-Xms256m -Xmx1g"
CMD ["sh", "-c", "java $JAVA_OPTS -jar /app/potholeiq.jar --server.port=${PORT:-8080}"]
