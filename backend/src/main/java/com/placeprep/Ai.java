package com.placeprep;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/ai")
class Ai {
  final JdbcTemplate db;
  final Identity identity;
  final RestClient client;
  final ObjectMapper json;

  Ai(
      JdbcTemplate db,
      Identity identity,
      ObjectMapper json,
      @Value("${placeprep.ai-url}") String url) {
    this.db = db;
    this.identity = identity;
    this.json = json;
    var factory =
        new JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build());
    factory.setReadTimeout(Duration.ofSeconds(45));
    client = RestClient.builder().baseUrl(url).requestFactory(factory).build();
  }

  record Request(
      @NotBlank @Size(max = 20000) String text,
      @NotBlank @Size(max = 300) String target,
      @AssertTrue boolean consent) {}

  @PostMapping({"/resume/analyze", "/interviews/evaluate"})
  Object analyze(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody Request input,
      jakarta.servlet.http.HttpServletRequest request) {
    var a = identity.actor(jwt);
    a.student();
    if (db.queryForObject(
            "SELECT count(*) FROM ai_reports WHERE tenant_id=? AND member_id=? AND"
                + " created_at>now()-interval '1 hour'",
            Integer.class,
            a.tenant(),
            a.id())
        >= 10)
      throw new ResponseStatusException(TOO_MANY_REQUESTS, "Hourly AI report limit reached");
    String kind = request.getRequestURI().contains("resume") ? "resume" : "interview";
    Map<?, ?> report;
    try {
      report =
          client
              .post()
              .uri("/analyze/" + kind)
              .body(Map.of("text", input.text(), "target", input.target()))
              .retrieve()
              .body(Map.class);
    } catch (Exception e) {
      throw new ResponseStatusException(
          SERVICE_UNAVAILABLE,
          "AI analysis is unavailable. Configure the AI service and provider key; no report has"
              + " been fabricated.");
    }
    if (report == null)
      throw new ResponseStatusException(BAD_GATEWAY, "AI provider returned an empty result");
    UUID id = UUID.randomUUID();
    try {
      db.update(
          "INSERT INTO ai_reports(id,tenant_id,member_id,kind,report) VALUES (?,?,?,?,?::jsonb)",
          id,
          a.tenant(),
          a.id(),
          kind,
          json.writeValueAsString(report));
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
    return Map.of("id", id, "report", report);
  }

  @GetMapping("/reports")
  Object reports(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    var rows =
        db.queryForList(
            "SELECT id,kind,report::text AS report,created_at FROM ai_reports WHERE tenant_id=? AND"
                + " member_id=? ORDER BY created_at DESC LIMIT 50",
            a.tenant(),
            a.id());
    return rows;
  }

  @DeleteMapping("/reports/{id}")
  Object delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    if (db.update(
            "DELETE FROM ai_reports WHERE tenant_id=? AND member_id=? AND id=?",
            a.tenant(),
            a.id(),
            id)
        == 0) throw new ResponseStatusException(NOT_FOUND, "Report not found");
    return Map.of("deleted", true);
  }
}
