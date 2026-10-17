package com.placeprep;

import static org.springframework.http.HttpStatus.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
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
class Portal {
  final JdbcTemplate db;
  final Identity identity;

  Portal(JdbcTemplate db, Identity identity) {
    this.db = db;
    this.identity = identity;
  }

  Map<String, Object> profile(Identity.Actor a) {
    return db.queryForMap(
        "SELECT"
            + " m.id,m.name,m.email,m.role,m.department,m.batch,m.registration,m.skills,m.cgpa,m.academic_verified,t.name"
            + " AS college,t.brand_color FROM members m JOIN tenants t ON t.id=m.tenant_id WHERE"
            + " m.tenant_id=? AND m.id=?",
        a.tenant(),
        a.id());
  }

  @GetMapping({"/me", "/me/profile"})
  Object me(@AuthenticationPrincipal Jwt jwt) {
    return profile(identity.actor(jwt));
  }

  record Profile(
      @NotBlank @Size(max = 100) String name,
      @Size(max = 100) String department,
      @Size(max = 30) String batch,
      @Size(max = 60) String registration,
      @Size(max = 500) String skills) {}

  @PutMapping("/me/profile")
  Object updateProfile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Profile p) {
    var a = identity.actor(jwt);
    db.update(
        "UPDATE members SET name=?,department=?,batch=?,registration=?,skills=? WHERE tenant_id=?"
            + " AND id=?",
        p.name(),
        safe(p.department()),
        safe(p.batch()),
        safe(p.registration()),
        safe(p.skills()),
        a.tenant(),
        a.id());
    return profile(a);
  }

  @GetMapping("/me/dashboard")
  Object dashboard(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    var coding =
        db.queryForMap(
            "SELECT count(*) AS solved,coalesce(sum(points),0) AS points FROM point_ledger WHERE"
                + " tenant_id=? AND member_id=?",
            a.tenant(),
            a.id());
    var tests =
        db.queryForMap(
            "SELECT count(*) AS completed,coalesce(round(avg(100.0*score/nullif(total,0))),0) AS"
                + " aptitude FROM attempts WHERE tenant_id=? AND member_id=? AND finalized=true",
            a.tenant(),
            a.id());
    var activity =
        db.queryForList(
            "SELECT s.id,s.verdict,s.created_at,p.title FROM submissions s JOIN problems p ON"
                + " p.id=s.problem_id AND p.tenant_id=s.tenant_id WHERE s.tenant_id=? AND"
                + " s.member_id=? ORDER BY s.created_at DESC LIMIT 7",
            a.tenant(),
            a.id());
    return Map.of(
        "profile",
        profile(a),
        "coding",
        coding,
        "assessments",
        tests,
        "activity",
        activity,
        "plan",
        List.of(
            Map.of("title", "Practice an array problem", "href", "/coding"),
            Map.of("title", "Check your quantitative foundations", "href", "/aptitude"),
            Map.of("title", "Update your skills and profile", "href", "/profile")),
        "readiness",
        Map.of(
            "available",
            false,
            "reason",
            "Readiness weights require college review; no employment probability is calculated."));
  }

  @GetMapping("/me/notifications")
  Object notifications(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT id,title,body,created_at FROM notifications WHERE tenant_id=? ORDER BY created_at"
            + " DESC LIMIT 100",
        a.tenant());
  }

  record Notice(@NotBlank @Size(max = 150) String title, @NotBlank @Size(max = 3000) String body) {}

  @PostMapping("/notifications")
  @ResponseStatus(CREATED)
  Object notice(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Notice n) {
    var a = identity.actor(jwt);
    a.staff();
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO notifications(id,tenant_id,title,body) VALUES (?,?,?,?)",
        id,
        a.tenant(),
        n.title(),
        n.body());
    identity.audit(a, "publish_announcement", id);
    return Map.of("id", id);
  }

  @GetMapping("/leaderboard")
  Object leaderboard(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT row_number() OVER(ORDER BY sum(l.points) DESC,min(l.created_at),m.id) AS"
            + " rank,m.id,split_part(m.name,' ',1) AS name,m.department,sum(l.points) AS"
            + " points,count(*) AS solved FROM point_ledger l JOIN members m ON m.id=l.member_id"
            + " AND m.tenant_id=l.tenant_id WHERE l.tenant_id=? GROUP BY m.id,m.name,m.department"
            + " ORDER BY rank LIMIT 100",
        a.tenant());
  }

  @GetMapping("/materials")
  Object materials(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT r.id,r.title,r.topic,r.type,r.url,m.name AS author,coalesce(p.completed,false) AS"
            + " completed FROM resources r JOIN members m ON r.author_id=m.id AND"
            + " r.tenant_id=m.tenant_id LEFT JOIN resource_progress p ON p.resource_id=r.id AND"
            + " p.tenant_id=r.tenant_id AND p.member_id=? WHERE r.tenant_id=? ORDER BY r.created_at"
            + " DESC LIMIT 200",
        a.id(),
        a.tenant());
  }

  record Resource(
      @NotBlank @Size(max = 150) String title,
      @NotBlank @Size(max = 80) String topic,
      @Pattern(regexp = "Article|Video|Notes") @NotNull String type,
      @NotBlank @Size(max = 1000) @Pattern(regexp = "https://[^\\s]+") String url) {}

  @PostMapping("/materials")
  @ResponseStatus(CREATED)
  Object resource(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Resource r) {
    var a = identity.actor(jwt);
    a.staff();
    var id = UUID.randomUUID();
    db.update(
        "INSERT INTO resources(id,tenant_id,title,topic,type,url,author_id) VALUES (?,?,?,?,?,?,?)",
        id,
        a.tenant(),
        r.title(),
        r.topic(),
        r.type(),
        r.url(),
        a.id());
    identity.audit(a, "publish_resource", id);
    return Map.of("id", id);
  }

  @PutMapping("/materials/{id}/progress")
  Object progress(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody Map<String, Boolean> input) {
    var a = identity.actor(jwt);
    if (count("SELECT count(*) FROM resources WHERE tenant_id=? AND id=?", a.tenant(), id) == 0)
      throw new ResponseStatusException(NOT_FOUND, "Resource not found");
    db.update(
        "INSERT INTO resource_progress VALUES (?,?,?,?) ON"
            + " CONFLICT(tenant_id,member_id,resource_id) DO UPDATE SET"
            + " completed=excluded.completed",
        a.tenant(),
        a.id(),
        id,
        Boolean.TRUE.equals(input.get("completed")));
    return Map.of("ok", true);
  }

  @GetMapping("/placement-drives")
  Object drives(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    return db.queryForList(
        "SELECT d.*,ap.status AS application_status FROM drives d LEFT JOIN applications ap ON"
            + " ap.drive_id=d.id AND ap.tenant_id=d.tenant_id AND ap.member_id=? WHERE"
            + " d.tenant_id=? ORDER BY d.deadline LIMIT 200",
        a.id(),
        a.tenant());
  }

  Map<String, Object> drive(Identity.Actor a, UUID id) {
    return db
        .queryForList("SELECT * FROM drives WHERE tenant_id=? AND id=?", a.tenant(), id)
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Drive not found"));
  }

  @GetMapping("/placement-drives/{id}/eligibility")
  Object eligibility(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return eligibility(identity.actor(jwt), id);
  }

  Map<String, Object> eligibility(Identity.Actor a, UUID id) {
    var d = drive(a, id);
    var p = profile(a);
    if (((java.sql.Timestamp) d.get("deadline")).toInstant().isBefore(Instant.now()))
      return Map.of("status", "Not Eligible", "reason", "Registration has closed");
    if (!Boolean.TRUE.equals(p.get("academic_verified")) || p.get("cgpa") == null)
      return Map.of(
          "status",
          "Verification Required",
          "reason",
          "Your placement team must verify your academic record first");
    boolean eligible =
        ((Number) p.get("cgpa")).doubleValue() >= ((Number) d.get("min_cgpa")).doubleValue();
    return Map.of(
        "status",
        eligible ? "Eligible" : "Not Eligible",
        "reason",
        eligible
            ? "Your verified CGPA meets the published minimum"
            : "Your verified CGPA is below the published minimum");
  }

  record Drive(
      @NotBlank @Size(max = 120) String company,
      @NotBlank @Size(max = 150) String title,
      @NotBlank @Size(max = 150) String location,
      @NotBlank @Size(max = 100) String salary,
      @NotBlank @Size(max = 500) String skills,
      @DecimalMin("0") @DecimalMax("10") double minCgpa,
      @NotNull @Future Instant deadline) {}

  @PostMapping("/placement-drives")
  @ResponseStatus(CREATED)
  Object createDrive(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Drive d) {
    var a = identity.actor(jwt);
    a.admin();
    var id = UUID.randomUUID();
    db.update(
        "INSERT INTO drives(id,tenant_id,company,title,location,salary,skills,min_cgpa,deadline)"
            + " VALUES (?,?,?,?,?,?,?,?,?)",
        id,
        a.tenant(),
        d.company(),
        d.title(),
        d.location(),
        d.salary(),
        d.skills(),
        d.minCgpa(),
        java.sql.Timestamp.from(d.deadline()));
    identity.audit(a, "create_drive", id);
    return Map.of("id", id);
  }

  @PostMapping("/placement-drives/{id}/applications")
  @ResponseStatus(CREATED)
  @Transactional
  Object apply(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    var a = identity.actor(jwt);
    a.student();
    if (!eligibility(a, id).get("status").equals("Eligible"))
      throw new ResponseStatusException(FORBIDDEN, "Verified eligibility is required");
    var app = UUID.randomUUID();
    db.update(
        "INSERT INTO applications(id,tenant_id,member_id,drive_id) VALUES (?,?,?,?)",
        app,
        a.tenant(),
        a.id(),
        id);
    identity.audit(a, "apply_drive", id);
    return Map.of("id", app);
  }

  @GetMapping("/admin/students")
  Object students(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    a.admin();
    return db.queryForList(
        "SELECT id,name,email,department,cgpa,academic_verified FROM members WHERE tenant_id=? AND"
            + " role='STUDENT' ORDER BY name LIMIT 500",
        a.tenant());
  }

  record Academic(@NotNull @DecimalMin("0") @DecimalMax("10") Double cgpa, boolean verified) {}

  @PutMapping("/admin/students/{id}/academic")
  @Transactional
  Object academic(
      @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, @Valid @RequestBody Academic p) {
    var a = identity.actor(jwt);
    a.admin();
    if (db.update(
            "UPDATE members SET cgpa=?,academic_verified=? WHERE tenant_id=? AND id=? AND"
                + " role='STUDENT'",
            p.cgpa(),
            p.verified(),
            a.tenant(),
            id)
        == 0) throw new ResponseStatusException(NOT_FOUND, "Student not found");
    identity.audit(a, "verify_academic", id);
    return Map.of("ok", true);
  }

  @GetMapping("/admin/applications")
  Object applications(@AuthenticationPrincipal Jwt jwt) {
    var a = identity.actor(jwt);
    a.admin();
    return db.queryForList(
        "SELECT ap.id,ap.status,m.name,m.email,d.company,d.title FROM applications ap JOIN members"
            + " m ON m.id=ap.member_id AND m.tenant_id=ap.tenant_id JOIN drives d ON"
            + " d.id=ap.drive_id AND d.tenant_id=ap.tenant_id WHERE ap.tenant_id=? ORDER BY"
            + " ap.created_at DESC LIMIT 500",
        a.tenant());
  }

  @PatchMapping("/admin/applications/{id}")
  Object stage(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody Map<String, String> input) {
    var a = identity.actor(jwt);
    a.admin();
    String status = input.get("status");
    if (!List.of("Applied", "Under review", "Interview", "Offer", "Not selected").contains(status))
      throw new ResponseStatusException(BAD_REQUEST, "Invalid recruitment stage");
    if (db.update(
            "UPDATE applications SET status=? WHERE tenant_id=? AND id=?", status, a.tenant(), id)
        == 0) throw new ResponseStatusException(NOT_FOUND, "Application not found");
    identity.audit(a, "recruitment_stage_" + status, id);
    return Map.of("ok", true);
  }

  int count(String sql, Object... args) {
    return db.queryForObject(sql, Integer.class, args);
  }

  static String safe(String s) {
    return s == null ? "" : s;
  }
}
