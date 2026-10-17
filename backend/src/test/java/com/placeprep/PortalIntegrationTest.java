package com.placeprep;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
    properties = {
      "spring.datasource.url=${TEST_DATABASE_URL:jdbc:postgresql://localhost:5432/placeprep_test}",
      "spring.rabbitmq.listener.simple.auto-startup=false",
      "placeprep.judge-enabled=false",
      "placeprep.ai-url=http://localhost:19999"
    })
@AutoConfigureMockMvc
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PortalIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate db;
  @Autowired ObjectMapper json;
  static final String A = "11111111-1111-4111-8111-111111111111",
      B = "22222222-2222-4222-8222-222222222222",
      PROBLEM = "20000000-0000-4000-8000-000000000001",
      ASSESSMENT = "30000000-0000-4000-8000-000000000001";
  static UUID attempt;

  JwtRequestPostProcessor who(String subject, String tenant, String role) {
    return jwt()
        .jwt(
            j ->
                j.subject(subject)
                    .claim("tenant_id", tenant)
                    .claim("name", "Test Student")
                    .claim("email", subject + "@test.invalid")
                    .claim("realm_access", Map.of("roles", List.of(role)))
                    .audience(List.of("placeprep-api")));
  }

  JwtRequestPostProcessor student() {
    return who("student-a", A, "STUDENT");
  }

  @BeforeEach
  void requireTestDatabase() {
    Assertions.assertTrue(
        db.queryForObject("SELECT current_database()", String.class).endsWith("_test"),
        "Refusing to run mutation tests outside a dedicated _test database");
  }

  @BeforeAll
  static void note() {
    System.out.println(
        "Integration tests use actual PostgreSQL and Flyway. Mock JWTs isolate API authorization"
            + " tests from the identity server; no judge execution is simulated as real.");
  }

  @Test
  @Order(1)
  void authenticationRequired() throws Exception {
    mvc.perform(get("/api/v1/me")).andExpect(status().isUnauthorized());
  }

  @Test
  @Order(2)
  void profileAndEmptyRealProgress() throws Exception {
    mvc.perform(get("/api/v1/me/dashboard").with(student()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.coding.solved").value(0))
        .andExpect(jsonPath("$.coding.points").value(0));
  }

  @Test
  @Order(3)
  void questionBankSearchAndSecrets() throws Exception {
    mvc.perform(get("/api/v1/coding/problems?q=Sum&difficulty=Easy").with(student()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(1))
        .andExpect(jsonPath("$.items[0].title").value("Sum of an Array"))
        .andExpect(jsonPath("$.items[0].answer").doesNotExist());
    mvc.perform(get("/api/v1/coding/problems/sum-of-array").with(student()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.expected").doesNotExist())
        .andExpect(jsonPath("$.judge_cases").doesNotExist());
    mvc.perform(get("/api/v1/coding/problems?size=1000").with(student()))
        .andExpect(status().isBadRequest());
  }

  @Test
  @Order(4)
  void tenantIsolation() throws Exception {
    db.update(
        "INSERT INTO tenants(id,name) VALUES (?,'Other college') ON CONFLICT DO NOTHING",
        UUID.fromString(B));
    mvc.perform(get("/api/v1/coding/problems").with(who("student-b", B, "STUDENT")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(0));
    mvc.perform(get("/api/v1/coding/problems/sum-of-array").with(who("student-b", B, "STUDENT")))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/me").with(jwt().jwt(j -> j.subject("no-tenant"))))
        .andExpect(status().isForbidden());
  }

  @Test
  @Order(5)
  void draftPersistenceOwnershipAndConflict() throws Exception {
    db.update("DELETE FROM drafts WHERE problem_id=?", UUID.fromString(PROBLEM));
    String path = "/api/v1/coding/drafts/" + PROBLEM;
    String body = "{\"language\":\"java\",\"source\":\"class Main {}\",\"version\":0}";
    mvc.perform(put(path).with(student()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.version").value(1));
    mvc.perform(get(path).with(student())).andExpect(jsonPath("$.source").value("class Main {}"));
    mvc.perform(get(path).with(who("another", A, "STUDENT")))
        .andExpect(jsonPath("$.version").value(0));
    mvc.perform(put(path).with(student()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isConflict());
    mvc.perform(
            put(path)
                .with(who("student-b", B, "STUDENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
        .andExpect(status().isNotFound());
  }

  @Test
  @Order(6)
  void judgeUnavailableDoesNotFabricateVerdict() throws Exception {
    mvc.perform(
            post("/api/v1/coding/runs")
                .with(student())
                .header("Idempotency-Key", UUID.randomUUID())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"problemId\":\""
                        + PROBLEM
                        + "\",\"language\":\"java\",\"source\":\"class Main {}\"}"))
        .andExpect(status().isServiceUnavailable());
  }

  @Test
  @Order(7)
  void studentCannotPublishOrVerify() throws Exception {
    mvc.perform(
            post("/api/v1/notifications")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Test\",\"body\":\"Denied\"}"))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/admin/students").with(student())).andExpect(status().isForbidden());
  }

  @Test
  @Order(8)
  void staffPublishResourceAndStudentComplete() throws Exception {
    var response =
        mvc.perform(
                post("/api/v1/materials")
                    .with(who("faculty", A, "FACULTY"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"title\":\"Java"
                            + " docs\",\"topic\":\"Java\",\"type\":\"Article\",\"url\":\"https://docs.oracle.com/en/java/\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    String id = json.readTree(response.getResponse().getContentAsString()).get("id").asText();
    mvc.perform(
            put("/api/v1/materials/" + id + "/progress")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":true}"))
        .andExpect(status().isOk());
    mvc.perform(
            put("/api/v1/materials/" + id + "/progress")
                .with(who("student-b", B, "STUDENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"completed\":true}"))
        .andExpect(status().isNotFound());
  }

  @Test
  @Order(9)
  void assessmentDurabilityAndHiddenAnswers() throws Exception {
    db.update("DELETE FROM attempt_answers");
    db.update("DELETE FROM attempts");
    var response =
        mvc.perform(
                post("/api/v1/assessments/" + ASSESSMENT + "/attempts")
                    .with(student())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andExpect(status().isOk())
            .andReturn();
    attempt =
        UUID.fromString(
            json.readTree(response.getResponse().getContentAsString()).get("id").asText());
    mvc.perform(get("/api/v1/attempts/" + attempt).with(student()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.questions[0].answer").doesNotExist());
    var question =
        db.queryForMap(
            "SELECT id,answer FROM questions WHERE assessment_id=? ORDER BY id LIMIT 1",
            UUID.fromString(ASSESSMENT));
    String answerPath = "/api/v1/attempts/" + attempt + "/answers/" + question.get("id");
    String body = "{\"choice\":" + question.get("answer") + ",\"marked\":true}";
    for (int i = 0; i < 2; i++)
      mvc.perform(
              put(answerPath).with(student()).contentType(MediaType.APPLICATION_JSON).content(body))
          .andExpect(status().isOk());
    mvc.perform(get("/api/v1/attempts/" + attempt).with(who("another", A, "STUDENT")))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/attempts/" + attempt + "/result").with(student()))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/v1/attempts/" + attempt + "/submit")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.attempt.score").value(1));
    mvc.perform(
            put(answerPath).with(student()).contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isConflict());
    mvc.perform(
            post("/api/v1/attempts/" + attempt + "/submit")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(jsonPath("$.attempt.score").value(1));
  }

  @Test
  @Order(10)
  void assessmentDeadlineIsServerEnforced() throws Exception {
    var response =
        mvc.perform(
                post("/api/v1/assessments/" + ASSESSMENT + "/attempts")
                    .with(student())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}"))
            .andReturn();
    UUID id =
        UUID.fromString(
            json.readTree(response.getResponse().getContentAsString()).get("id").asText());
    db.update("UPDATE attempts SET deadline=now()-interval '1 minute' WHERE id=?", id);
    UUID question =
        db.queryForObject(
            "SELECT id FROM questions WHERE assessment_id=? LIMIT 1",
            UUID.class,
            UUID.fromString(ASSESSMENT));
    mvc.perform(
            put("/api/v1/attempts/" + id + "/answers/" + question)
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"choice\":0,\"marked\":false}"))
        .andExpect(status().isConflict());
    mvc.perform(get("/api/v1/attempts/" + id).with(student()))
        .andExpect(jsonPath("$.attempt.finalized").value(true));
  }

  @Test
  @Order(11)
  void eligibilityRequiresVerificationAndIsTenantScoped() throws Exception {
    var admin = who("admin", A, "ADMIN");
    var response =
        mvc.perform(
                post("/api/v1/placement-drives")
                    .with(admin)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        "{\"company\":\"Integration Test"
                            + " Employer\",\"title\":\"Engineer\",\"location\":\"Remote\",\"salary\":\"Published"
                            + " by college\",\"skills\":\"Java\",\"minCgpa\":7,\"deadline\":\"2099-01-01T00:00:00Z\"}"))
            .andExpect(status().isCreated())
            .andReturn();
    String id = json.readTree(response.getResponse().getContentAsString()).get("id").asText();
    db.update("UPDATE members SET academic_verified=false WHERE subject='student-a'");
    mvc.perform(get("/api/v1/placement-drives/" + id + "/eligibility").with(student()))
        .andExpect(jsonPath("$.status").value("Verification Required"));
    mvc.perform(
            post("/api/v1/placement-drives/" + id + "/applications")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isForbidden());
    UUID member =
        db.queryForObject(
            "SELECT id FROM members WHERE tenant_id=? AND subject='student-a'",
            UUID.class,
            UUID.fromString(A));
    mvc.perform(
            put("/api/v1/admin/students/" + member + "/academic")
                .with(admin)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cgpa\":8.5,\"verified\":true}"))
        .andExpect(status().isOk());
    mvc.perform(get("/api/v1/placement-drives/" + id + "/eligibility").with(student()))
        .andExpect(jsonPath("$.status").value("Eligible"));
    mvc.perform(
            post("/api/v1/placement-drives/" + id + "/applications")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isCreated());
    mvc.perform(
            post("/api/v1/placement-drives/" + id + "/applications")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isConflict());
    mvc.perform(
            get("/api/v1/placement-drives/" + id + "/eligibility")
                .with(who("student-b", B, "STUDENT")))
        .andExpect(status().isNotFound());
  }

  @Test
  @Order(12)
  void aiRequiresConsentAndDoesNotInventResults() throws Exception {
    mvc.perform(
            post("/api/v1/ai/resume/analyze")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"Resume\",\"target\":\"Engineer\",\"consent\":false}"))
        .andExpect(status().isBadRequest());
    mvc.perform(
            post("/api/v1/ai/resume/analyze")
                .with(student())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"text\":\"Resume\",\"target\":\"Engineer\",\"consent\":true}"))
        .andExpect(status().isServiceUnavailable());
  }
}
