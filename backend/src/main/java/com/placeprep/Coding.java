package com.placeprep;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/coding")
class Coding {
  final JdbcTemplate db;
  final Identity identity;
  final Judge judge;

  Coding(JdbcTemplate db, Identity identity, Judge judge) {
    this.db = db;
    this.identity = identity;
    this.judge = judge;
  }

  @GetMapping("/problems")
  Object problems(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "") String q,
      @RequestParam(defaultValue = "") String difficulty,
      @RequestParam(defaultValue = "") String topic,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    var a = identity.actor(jwt);
    if (page < 0 || page > 10000 || size < 1 || size > 100 || q.length() > 100)
      throw new ResponseStatusException(BAD_REQUEST, "Invalid pagination or search");
    String filter =
        " FROM problems p WHERE p.tenant_id=? AND p.published=true AND p.title ILIKE ? AND (?='' OR"
            + " p.difficulty=?) AND (?='' OR p.topic=?)";
    Object[] args = {a.tenant(), "%" + q + "%", difficulty, difficulty, topic, topic};
    var list = new ArrayList<Object>();
    list.add(a.id());
    list.addAll(Arrays.asList(args));
    list.add(size);
    list.add(page * size);
    return Map.of(
        "items",
        db.queryForList(
            "SELECT p.id,p.slug,p.title,p.difficulty,p.topic,EXISTS(SELECT 1 FROM solved_problems s"
                + " WHERE s.tenant_id=p.tenant_id AND s.problem_id=p.id AND s.member_id=?) AS"
                + " solved"
                + filter
                + " ORDER BY p.title LIMIT ? OFFSET ?",
            list.toArray()),
        "total",
        db.queryForObject("SELECT count(*)" + filter, Integer.class, args),
        "page",
        page,
        "size",
        size);
  }

  Map<String, Object> problem(Identity.Actor a, String slug) {
    return db
        .queryForList(
            "SELECT"
                + " id,slug,title,difficulty,topic,statement,input_format,output_format,constraints_text,sample_input,sample_output,explanation,version"
                + " FROM problems WHERE tenant_id=? AND slug=? AND published=true",
            a.tenant(),
            slug)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Problem not found"));
  }

  @GetMapping("/problems/{slug}")
  Object problem(@AuthenticationPrincipal Jwt jwt, @PathVariable String slug) {
    return problem(identity.actor(jwt), slug);
  }

  @GetMapping("/languages")
  Object languages() {
    return judge.languages();
  }

  record Draft(
      @NotNull @Pattern(regexp = "java|python|cpp|javascript") String language,
      @NotNull @Size(max = 50000) String source,
      @Min(0) int version) {}

  @GetMapping("/drafts/{problemId}")
  Object draft(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID problemId,
      @RequestParam(defaultValue = "java") String language) {
    var a = identity.actor(jwt);
    return db
        .queryForList(
            "SELECT source,language,version,updated_at FROM drafts WHERE tenant_id=? AND"
                + " member_id=? AND problem_id=? AND language=?",
            a.tenant(),
            a.id(),
            problemId,
            language)
        .stream()
        .findFirst()
        .orElse(Map.of("source", "", "language", language, "version", 0));
  }

  @PutMapping("/drafts/{problemId}")
  @Transactional
  Object save(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID problemId, @Valid @RequestBody Draft d) {
    var a = identity.actor(jwt);
    a.student();
    if (db.queryForObject(
            "SELECT count(*) FROM problems WHERE id=? AND tenant_id=? AND published=true",
            Integer.class,
            problemId,
            a.tenant())
        == 0) throw new ResponseStatusException(NOT_FOUND, "Problem not found");
    int changes;
    if (d.version() == 0)
      changes =
          db.update(
              "INSERT INTO drafts(tenant_id,member_id,problem_id,language,source) VALUES"
                  + " (?,?,?,?,?) ON CONFLICT DO NOTHING",
              a.tenant(),
              a.id(),
              problemId,
              d.language(),
              d.source());
    else
      changes =
          db.update(
              "UPDATE drafts SET source=?,version=version+1,updated_at=now() WHERE tenant_id=? AND"
                  + " member_id=? AND problem_id=? AND language=? AND version=?",
              d.source(),
              a.tenant(),
              a.id(),
              problemId,
              d.language(),
              d.version());
    if (changes == 0)
      throw new ResponseStatusException(
          CONFLICT, "Draft changed in another tab. Reload before saving.");
    return Map.of("version", d.version() + 1);
  }

  record Code(
      @NotNull UUID problemId,
      @NotNull @Pattern(regexp = "java|python|cpp|javascript") String language,
      @NotBlank @Size(max = 50000) String source) {}

  @PostMapping({"/runs", "/submissions"})
  @ResponseStatus(ACCEPTED)
  @Transactional
  Object execute(
      @AuthenticationPrincipal Jwt jwt,
      @Valid @RequestBody Code code,
      @RequestHeader("Idempotency-Key") @Size(min = 8, max = 100) String key,
      jakarta.servlet.http.HttpServletRequest request) {
    var a = identity.actor(jwt);
    a.student();
    if (key.length() < 8 || key.length() > 100)
      throw new ResponseStatusException(BAD_REQUEST, "Invalid idempotency key");
    String mode = request.getRequestURI().endsWith("/runs") ? "run" : "submit";
    var existing =
        db.queryForList(
            "SELECT id,problem_id,language,source,mode FROM submissions WHERE tenant_id=? AND"
                + " member_id=? AND idempotency_key=?",
            a.tenant(),
            a.id(),
            key);
    if (!existing.isEmpty()) {
      var old = existing.getFirst();
      if (!old.get("problem_id").equals(code.problemId())
          || !old.get("language").equals(code.language())
          || !old.get("source").equals(code.source())
          || !old.get("mode").equals(mode))
        throw new ResponseStatusException(
            CONFLICT, "Idempotency key already used for a different request");
      return Map.of("id", old.get("id"));
    }
    if (!judge.enabled(code.language()))
      throw new ResponseStatusException(
          SERVICE_UNAVAILABLE,
          "The isolated judge is not configured for this language. Draft saving is available.");
    var rows =
        db.queryForList(
            "SELECT version FROM problems WHERE tenant_id=? AND id=? AND published=true",
            a.tenant(),
            code.problemId());
    if (rows.isEmpty()) throw new ResponseStatusException(NOT_FOUND, "Problem not found");
    // Serialize student enqueue requests across API instances before applying the database-backed
    // limit.
    db.queryForList(
        "SELECT id FROM members WHERE tenant_id=? AND id=? FOR UPDATE", a.tenant(), a.id());
    if (db.queryForObject(
            "SELECT count(*) FROM submissions WHERE tenant_id=? AND member_id=? AND"
                + " created_at>now()-interval '1 minute'",
            Integer.class,
            a.tenant(),
            a.id())
        >= 6)
      throw new ResponseStatusException(
          TOO_MANY_REQUESTS, "Limit is six execution requests per minute");
    var id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " submissions(id,tenant_id,member_id,problem_id,problem_version,language,source,mode,idempotency_key)"
            + " VALUES (?,?,?,?,?,?,?,?,?)",
        id,
        a.tenant(),
        a.id(),
        code.problemId(),
        rows.getFirst().get("version"),
        code.language(),
        code.source(),
        mode,
        key);
    db.update(
        "INSERT INTO outbox_events(id,tenant_id,submission_id) VALUES (?,?,?)",
        UUID.randomUUID(),
        a.tenant(),
        id);
    return Map.of("id", id);
  }

  @GetMapping("/submissions/{id}")
  Object submission(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    return db
        .queryForList(
            "SELECT id,problem_id,language,mode,verdict,output,runtime,created_at FROM submissions"
                + " WHERE tenant_id=? AND member_id=? AND id=?",
            a.tenant(),
            a.id(),
            id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Submission not found"));
  }

  @GetMapping("/me/submissions")
  Object history(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT s.id,s.problem_id,s.language,s.mode,s.verdict,s.created_at,p.title FROM submissions"
            + " s JOIN problems p ON p.id=s.problem_id AND p.tenant_id=s.tenant_id WHERE"
            + " s.tenant_id=? AND s.member_id=? ORDER BY s.created_at DESC LIMIT 100",
        a.tenant(),
        a.id());
  }

  @GetMapping("/me/progress")
  Object progress(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return Map.of(
        "summary",
        db.queryForMap(
            "SELECT count(*) AS solved,coalesce(sum(points),0) AS points FROM point_ledger WHERE"
                + " tenant_id=? AND member_id=?",
            a.tenant(),
            a.id()),
        "topics",
        db.queryForList(
            "SELECT p.topic,count(*) AS solved FROM solved_problems s JOIN problems p ON"
                + " p.tenant_id=s.tenant_id AND p.id=s.problem_id WHERE s.tenant_id=? AND"
                + " s.member_id=? GROUP BY p.topic",
            a.tenant(),
            a.id()),
        "activity",
        db.queryForList(
            "SELECT created_at::date AS day,count(*) AS attempts FROM submissions WHERE tenant_id=?"
                + " AND member_id=? AND mode='submit' AND verdict NOT IN ('Internal Judge"
                + " Error','Queued','Running') AND created_at>now()-interval '7 days' GROUP BY day"
                + " ORDER BY day",
            a.tenant(),
            a.id()));
  }

  record NewProblem(
      @NotBlank @Pattern(regexp = "[a-z0-9-]+") @Size(max = 100) String slug,
      @NotBlank @Size(max = 150) String title,
      @NotNull @Pattern(regexp = "Easy|Medium|Hard") String difficulty,
      @NotBlank @Size(max = 80) String topic,
      @NotBlank @Size(max = 10000) String statement,
      @NotBlank @Size(max = 2000) String inputFormat,
      @NotBlank @Size(max = 2000) String outputFormat,
      @NotBlank @Size(max = 2000) String constraints,
      @NotBlank @Size(max = 10000) String sampleInput,
      @NotBlank @Size(max = 10000) String sampleOutput,
      @NotBlank @Size(max = 2000) String explanation) {}

  @PostMapping("/problems")
  @ResponseStatus(CREATED)
  @Transactional
  Object publish(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewProblem p) {
    var a = identity.actor(jwt);
    a.staff();
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " problems(id,tenant_id,slug,title,difficulty,topic,statement,input_format,output_format,constraints_text,sample_input,sample_output,explanation,published)"
            + " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,false)",
        id,
        a.tenant(),
        p.slug(),
        p.title(),
        p.difficulty(),
        p.topic(),
        p.statement(),
        p.inputFormat(),
        p.outputFormat(),
        p.constraints(),
        p.sampleInput(),
        p.sampleOutput(),
        p.explanation());
    identity.audit(a, "create_problem_draft", id);
    return Map.of("id", id, "published", false);
  }

  record HiddenCase(
      @NotBlank @Size(max = 50000) String input, @NotBlank @Size(max = 50000) String expected) {}

  @PostMapping("/problems/{id}/publish")
  @Transactional
  Object publish(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @Valid @RequestBody List<@Valid HiddenCase> cases) {
    var a = identity.actor(jwt);
    a.staff();
    if (cases.isEmpty() || cases.size() > 30)
      throw new ResponseStatusException(BAD_REQUEST, "Provide 1–30 protected tests");
    var rows =
        db.queryForList(
            "SELECT id FROM problems WHERE tenant_id=? AND id=? AND published=false FOR UPDATE",
            a.tenant(),
            id);
    if (rows.isEmpty())
      throw new ResponseStatusException(NOT_FOUND, "Unpublished problem not found");
    for (var c : cases)
      db.update(
          "INSERT INTO judge_cases VALUES (?,?,?,?,?)",
          UUID.randomUUID(),
          a.tenant(),
          id,
          c.input(),
          c.expected());
    db.update("UPDATE problems SET published=true WHERE tenant_id=? AND id=?", a.tenant(), id);
    identity.audit(a, "publish_problem", id);
    return Map.of("published", true);
  }
}
