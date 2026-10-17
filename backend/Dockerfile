FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
COPY src src
RUN mvn -B package -DskipTests
FROM eclipse-temurin:21.0.8_9-jre-alpine
WORKDIR /app
COPY --from=build /app/target/placeprep-api-1.0.0.jar app.jar
USER 65534:65534
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=70","-jar","app.jar"]
