package com.placeprep;

import static org.junit.jupiter.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Adapter protocol tests with an explicitly simulated provider. These do NOT execute student code.
 */
@SpringBootTest(
    properties = {
      "spring.datasource.url=${TEST_DATABASE_URL:jdbc:postgresql://localhost:5432/placeprep_test}",
      "spring.rabbitmq.listener.simple.auto-startup=false",
      "placeprep.judge-enabled=false",
      "placeprep.ai-url=http://localhost:19999"
    })
class JudgeProtocolIntegrationTest {
  @Autowired JdbcTemplate db;
  @Autowired RabbitTemplate rabbit;
  @Autowired PlatformTransactionManager manager;
  static final UUID TENANT = UUID.fromString("11111111-1111-4111-8111-111111111111"),
      PROBLEM = UUID.fromString("20000000-0000-4000-8000-000000000001");
  UUID member;
  HttpServer provider;
  int status;

  @BeforeEach
  void setUp() throws Exception {
    assertTrue(db.queryForObject("SELECT current_database()", String.class).endsWith("_test"));
    member = UUID.randomUUID();
    db.update(
        "INSERT INTO members(id,tenant_id,subject,name,email,role) VALUES (?,?,?,?,?,'STUDENT')",
        member,
        TENANT,
        "protocol-" + member,
        "Protocol Test",
        "test@test.invalid");
    status = 3;
    provider = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    provider.createContext(
        "/submissions",
        exchange -> {
          exchange.getRequestBody().readAllBytes();
          byte[] response =
              ("{\"status\":{\"id\":" + status + "},\"stdout\":\"private-output-marker\"}")
                  .getBytes(StandardCharsets.UTF_8);
          exchange.getResponseHeaders().set("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, response.length);
          exchange.getResponseBody().write(response);
          exchange.close();
        });
    provider.start();
  }

  @AfterEach
  void stop() {
    provider.stop(0);
  }

  Judge adapter() {
    return new Judge(
        db,
        rabbit,
        manager,
        true,
        "http://127.0.0.1:" + provider.getAddress().getPort(),
        "",
        62,
        71,
        54,
        63);
  }

  UUID enqueue(String mode) {
    UUID id = UUID.randomUUID();
    db.update(
        "INSERT INTO"
            + " submissions(id,tenant_id,member_id,problem_id,problem_version,language,source,mode,idempotency_key)"
            + " VALUES (?,?,?,?,1,'java','PROTOCOL TEST DATA - NOT EXECUTED',?,?)",
        id,
        TENANT,
        member,
        PROBLEM,
        mode,
        UUID.randomUUID().toString());
    return id;
  }

  int points() {
    return db.queryForObject(
        "SELECT coalesce(sum(points),0) FROM point_ledger WHERE tenant_id=? AND member_id=?",
        Integer.class,
        TENANT,
        member);
  }

  @Test
  void acceptedProtocolEventAwardsOnceAndKeepsHiddenOutputPrivate() {
    Judge judge = adapter();
    UUID first = enqueue("submit");
    judge.consume(first.toString());
    judge.consume(first.toString());
    UUID second = enqueue("submit");
    judge.consume(second.toString());
    assertEquals(10, points());
    assertEquals(
        1,
        db.queryForObject(
            "SELECT count(*) FROM solved_problems WHERE member_id=?", Integer.class, member));
    assertEquals(
        "Hidden-case output is private.",
        db.queryForObject("SELECT output FROM submissions WHERE id=?", String.class, first));
  }

  @Test
  void sampleRunCannotAwardPoints() {
    UUID id = enqueue("run");
    adapter().consume(id.toString());
    assertEquals(0, points());
    assertEquals(
        "private-output-marker",
        db.queryForObject("SELECT output FROM submissions WHERE id=?", String.class, id));
  }

  @Test
  void internalProviderStatusIsNotWrongAnswer() {
    status = 13;
    UUID id = enqueue("submit");
    adapter().consume(id.toString());
    assertEquals(0, points());
    assertEquals(
        "Internal Judge Error",
        db.queryForObject("SELECT verdict FROM submissions WHERE id=?", String.class, id));
  }
}
