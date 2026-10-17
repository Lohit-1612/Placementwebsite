package com.placeprep;

import static org.springframework.http.HttpStatus.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
class Assessments {
  final JdbcTemplate db;
  final Identity identity;
  final ObjectMapper json;

  Assessments(JdbcTemplate db, Identity identity, ObjectMapper json) {
    this.db = db;
    this.identity = identity;
    this.json = json;
  }

  @GetMapping("/assessments")
  Object list(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT a.id,a.title,a.category,a.duration_minutes,(SELECT count(*) FROM questions q WHERE"
            + " q.tenant_id=a.tenant_id AND q.assessment_id=a.id) AS questions FROM assessments a"
            + " WHERE tenant_id=? AND published=true ORDER BY title",
        a.tenant());
  }

  @PostMapping("/assessments/{id}/attempts")
  @Transactional
  Object start(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    a.student();
    db.queryForList(
        "SELECT id FROM members WHERE id=? AND tenant_id=? FOR UPDATE", a.id(), a.tenant());
    var existing =
        db.queryForList(
            "SELECT id FROM attempts WHERE tenant_id=? AND member_id=? AND assessment_id=? AND"
                + " finalized=false",
            a.tenant(),
            a.id(),
            id);
    if (!existing.isEmpty()) return Map.of("id", existing.getFirst().get("id"));
    var assessment =
        db.queryForList(
            "SELECT duration_minutes FROM assessments WHERE tenant_id=? AND id=? AND"
                + " published=true",
            a.tenant(),
            id);
    if (assessment.isEmpty()) throw new ResponseStatusException(NOT_FOUND, "Assessment not found");
    UUID attempt = UUID.randomUUID();
    db.update(
        "INSERT INTO attempts(id,tenant_id,member_id,assessment_id,deadline) VALUES (?,?,?,?,?)",
        attempt,
        a.tenant(),
        a.id(),
        id,
        Timestamp.from(
            Instant.now()
                .plusSeconds(
                    ((Number) assessment.getFirst().get("duration_minutes")).longValue() * 60)));
    return Map.of("id", attempt);
  }

  Map<String, Object> owned(Identity.Actor a, UUID id) {
    return db
        .queryForList(
            "SELECT * FROM attempts WHERE tenant_id=? AND member_id=? AND id=? FOR UPDATE",
            a.tenant(),
            a.id(),
            id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Attempt not found"));
  }

  @GetMapping("/attempts/{id}")
  @Transactional
  Object get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    var attempt = owned(a, id);
    if (!Boolean.TRUE.equals(attempt.get("finalized")) && expired(attempt)) {
      finish(a, id, attempt);
      attempt = owned(a, id);
    }
    var rows =
        db.queryForList(
            "SELECT id,prompt,options::text AS options FROM questions WHERE tenant_id=? AND"
                + " assessment_id=? ORDER BY id",
            a.tenant(),
            attempt.get("assessment_id"));
    for (var row : rows)
      try {
        row.put("options", json.readValue(row.get("options").toString(), List.class));
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    return Map.of(
        "attempt",
        attempt,
        "questions",
        rows,
        "answers",
        db.queryForList(
            "SELECT question_id,choice,marked FROM attempt_answers WHERE tenant_id=? AND"
                + " attempt_id=?",
            a.tenant(),
            id),
        "serverTime",
        Instant.now());
  }

  record Answer(@Min(0) @Max(3) Integer choice, boolean marked) {}

  @PutMapping("/attempts/{id}/answers/{questionId}")
  @Transactional
  Object answer(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @PathVariable UUID questionId,
      @Valid @RequestBody Answer answer) {
    var a = identity.actor(jwt);
    var attempt = owned(a, id);
    if (Boolean.TRUE.equals(attempt.get("finalized")) || expired(attempt))
      throw new ResponseStatusException(
          CONFLICT, "Attempt is finalized or its deadline has passed");
    if (db.queryForObject(
            "SELECT count(*) FROM questions WHERE tenant_id=? AND assessment_id=? AND id=?",
            Integer.class,
            a.tenant(),
            attempt.get("assessment_id"),
            questionId)
        == 0) throw new ResponseStatusException(NOT_FOUND, "Question not found in this assessment");
    db.update(
        "INSERT INTO attempt_answers VALUES (?,?,?,?,?) ON"
            + " CONFLICT(tenant_id,attempt_id,question_id) DO UPDATE SET"
            + " choice=excluded.choice,marked=excluded.marked",
        a.tenant(),
        id,
        questionId,
        answer.choice(),
        answer.marked());
    return Map.of("saved", true);
  }

  @PostMapping("/attempts/{id}/submit")
  @Transactional
  Object submit(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    var attempt = owned(a, id);
    if (!Boolean.TRUE.equals(attempt.get("finalized"))) finish(a, id, attempt);
    return result(a, id);
  }

  void finish(Identity.Actor a, UUID id, Map<String, Object> attempt) {
    var totals =
        db.queryForMap(
            "SELECT count(*) AS total,count(*) FILTER(WHERE ans.choice=q.answer) AS score FROM"
                + " questions q LEFT JOIN attempt_answers ans ON ans.question_id=q.id AND"
                + " ans.attempt_id=? AND ans.tenant_id=q.tenant_id WHERE q.tenant_id=? AND"
                + " q.assessment_id=?",
            id,
            a.tenant(),
            attempt.get("assessment_id"));
    db.update(
        "UPDATE attempts SET finalized=true,score=?,total=? WHERE tenant_id=? AND id=?",
        totals.get("score"),
        totals.get("total"),
        a.tenant(),
        id);
    identity.audit(a, "finalize_assessment", id);
  }

  @GetMapping("/attempts/{id}/result")
  @Transactional
  Object result(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return result(identity.actor(jwt), id);
  }

  Object result(Identity.Actor a, UUID id) {
    var attempt = owned(a, id);
    if (!Boolean.TRUE.equals(attempt.get("finalized"))) {
      if (expired(attempt)) {
        finish(a, id, attempt);
        attempt = owned(a, id);
      } else
        throw new ResponseStatusException(CONFLICT, "Submit the assessment before viewing answers");
    }
    return Map.of(
        "attempt",
        attempt,
        "review",
        db.queryForList(
            "SELECT q.id,q.prompt,q.answer,q.explanation,ans.choice FROM questions q LEFT JOIN"
                + " attempt_answers ans ON ans.question_id=q.id AND ans.attempt_id=? AND"
                + " ans.tenant_id=q.tenant_id WHERE q.tenant_id=? AND q.assessment_id=? ORDER BY"
                + " q.id",
            id,
            a.tenant(),
            attempt.get("assessment_id")));
  }

  boolean expired(Map<String, Object> attempt) {
    return !((Timestamp) attempt.get("deadline")).toInstant().isAfter(Instant.now());
  }

  record Question(
      @NotBlank @Size(max = 2000) String prompt,
      @Size(min = 4, max = 4) @NotNull List<@NotBlank @Size(max = 500) String> options,
      @Min(0) @Max(3) int answer,
      @NotBlank @Size(max = 2000) String explanation) {}

  record NewAssessment(
      @NotBlank @Size(max = 150) String title,
      @NotNull
          @Pattern(regexp = "Quantitative Aptitude|Logical Reasoning|Verbal Ability|Subject Tests")
          String category,
      @Min(1) @Max(180) int duration,
      @NotNull @Size(min = 1, max = 100) List<@Valid Question> questions) {}

  @PostMapping("/assessments")
  @Transactional
  @ResponseStatus(CREATED)
  Object create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewAssessment input)
      throws Exception {
    var a = identity.actor(jwt);
    a.staff();
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO assessments VALUES (?,?,?,?,?,true)",
        id,
        a.tenant(),
        input.title(),
        input.category(),
        input.duration());
    for (var q : input.questions())
      db.update(
          "INSERT INTO questions VALUES (?,?,?,?,?::jsonb,?,?)",
          UUID.randomUUID(),
          a.tenant(),
          id,
          q.prompt(),
          json.writeValueAsString(q.options()),
          q.answer(),
          q.explanation());
    identity.audit(a, "publish_assessment", id);
    return Map.of("id", id);
  }
}
