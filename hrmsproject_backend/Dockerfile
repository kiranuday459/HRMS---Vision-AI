# =============================================
# HRMS Backend Dockerfile
# Uses pre-built JAR from local Maven build
# Run: mvn clean package -DskipTests first
# =============================================

FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app

# Copy the pre-built JAR
COPY target/*.jar app.jar

EXPOSE 8080

# Pass env vars at runtime via: docker run --env-file .env
ENTRYPOINT ["java", "-jar", "app.jar"]