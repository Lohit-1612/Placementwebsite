package com.placeprep;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
class Identity {
  final JdbcTemplate db;

  Identity(JdbcTemplate db) {
    this.db = db;
  }

  record Actor(UUID id, UUID tenant, String role) {
    void staff() {
      if (!Set.of("FACULTY", "ADMIN", "PLATFORM_ADMIN").contains(role))
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff access required");
    }

    void admin() {
      if (!Set.of("ADMIN", "PLATFORM_ADMIN").contains(role))
        throw new ResponseStatusException(
            HttpStatus.FORBIDDEN, "College administrator access required");
    }

    void student() {
      if (!role.equals("STUDENT"))
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Student account required");
    }
  }

  Actor actor(Jwt jwt) {
    String claim = jwt.getClaimAsString("tenant_id");
    if (claim == null)
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "A verified college membership is required");
    UUID tenant;
    try {
      tenant = UUID.fromString(claim);
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid college membership");
    }
    if (db.queryForObject("SELECT count(*) FROM tenants WHERE id=?", Integer.class, tenant) == 0)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "College is not onboarded");
    Map<String, Object> realm = jwt.getClaim("realm_access");
    Object raw = realm == null ? null : realm.get("roles");
    List<?> roles = raw instanceof List<?> l ? l : List.of();
    String role = "STUDENT";
    for (String r : List.of("FACULTY", "RECRUITER", "HOD", "ADMIN", "PLATFORM_ADMIN"))
      if (roles.contains(r)) role = r;
    String name =
        Optional.ofNullable(jwt.getClaimAsString("name"))
            .orElse(
                Optional.ofNullable(jwt.getClaimAsString("preferred_username")).orElse("Student"));
    String email = Optional.ofNullable(jwt.getClaimAsString("email")).orElse("");
    db.update(
        "INSERT INTO members(id,tenant_id,subject,name,email,role) VALUES (?,?,?,?,?,?) ON"
            + " CONFLICT(tenant_id,subject) DO UPDATE SET role=excluded.role,email=excluded.email",
        UUID.randomUUID(),
        tenant,
        jwt.getSubject(),
        name,
        email,
        role);
    var row =
        db.queryForMap(
            "SELECT id,role FROM members WHERE tenant_id=? AND subject=?",
            tenant,
            jwt.getSubject());
    return new Actor((UUID) row.get("id"), tenant, (String) row.get("role"));
  }

  void audit(Actor a, String action, Object target) {
    db.update(
        "INSERT INTO audit_events(id,tenant_id,member_id,action,target) VALUES (?,?,?,?,?)",
        UUID.randomUUID(),
        a.tenant(),
        a.id(),
        action,
        String.valueOf(target));
  }
}
