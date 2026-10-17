package com.placeprep;

import java.time.Duration;
import java.util.*;
import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.RestClient;

@Service
class Judge {
  final JdbcTemplate db;
  final RabbitTemplate rabbit;
  final TransactionTemplate tx;
  final RestClient client;
  final boolean active;
  final Map<String, Integer> ids;

  Judge(
      JdbcTemplate db,
      RabbitTemplate rabbit,
      PlatformTransactionManager manager,
      @Value("${placeprep.judge-enabled}") boolean active,
      @Value("${placeprep.judge-url}") String url,
      @Value("${placeprep.judge-key}") String key,
      @Value("${placeprep.language-java}") int javaId,
      @Value("${placeprep.language-python}") int python,
      @Value("${placeprep.language-cpp}") int cpp,
      @Value("${placeprep.language-javascript}") int javascript) {
    this.db = db;
    this.rabbit = rabbit;
    this.tx = new TransactionTemplate(manager);
    this.active = active && !url.isBlank();
    ids = Map.of("java", javaId, "python", python, "cpp", cpp, "javascript", javascript);
    var factory =
        new JdkClientHttpRequestFactory(
            java.net.http.HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    factory.setReadTimeout(Duration.ofSeconds(20));
    this.client =
        RestClient.builder()
            .baseUrl(url.isBlank() ? "http://localhost:2358" : url)
            .requestFactory(factory)
            .defaultHeader("X-Auth-Token", key)
            .build();
  }

  @Bean
  org.springframework.amqp.core.Queue judgeQueue() {
    return QueueBuilder.durable("placeprep.judge")
        .withArgument("x-dead-letter-exchange", "placeprep.dead")
        .build();
  }

  @Bean
  DirectExchange deadExchange() {
    return new DirectExchange("placeprep.dead");
  }

  @Bean
  org.springframework.amqp.core.Queue deadQueue() {
    return QueueBuilder.durable("placeprep.judge.dead").build();
  }

  @Bean
  Binding deadBinding() {
    return BindingBuilder.bind(deadQueue()).to(deadExchange()).with("placeprep.judge");
  }

  boolean enabled(String language) {
    return active && ids.getOrDefault(language, 0) > 0;
  }

  Object languages() {
    return List.of(
        Map.of("id", "java", "name", "Java 21", "enabled", enabled("java")),
        Map.of("id", "python", "name", "Python 3", "enabled", enabled("python")),
        Map.of("id", "cpp", "name", "C++17", "enabled", enabled("cpp")),
        Map.of("id", "javascript", "name", "JavaScript", "enabled", enabled("javascript")));
  }

  @Scheduled(fixedDelay = 3000)
  void publish() {
    if (!active) return;
    tx.executeWithoutResult(
        s -> {
          var rows =
              db.queryForList(
                  "SELECT id,submission_id FROM outbox_events WHERE published=false ORDER BY"
                      + " created_at LIMIT 20 FOR UPDATE SKIP LOCKED");
          for (var row : rows) {
            rabbit.invoke(
                ops -> {
                  ops.convertAndSend("", "placeprep.judge", row.get("submission_id").toString());
                  ops.waitForConfirmsOrDie(5000);
                  return true;
                });
            db.update("UPDATE outbox_events SET published=true WHERE id=?", row.get("id"));
          }
        });
  }

  @RabbitListener(queues = "placeprep.judge")
  void consume(String raw) {
    UUID id = UUID.fromString(raw);
    tx.executeWithoutResult(
        s -> {
          var rows =
              db.queryForList(
                  "SELECT s.*,p.difficulty,p.sample_input,p.sample_output FROM submissions s JOIN"
                      + " problems p ON p.id=s.problem_id AND p.tenant_id=s.tenant_id WHERE s.id=?"
                      + " FOR UPDATE OF s",
                  id);
          if (rows.isEmpty()) return;
          var submission = rows.getFirst();
          if (!submission.get("verdict").equals("Queued")) return;
          db.update("UPDATE submissions SET verdict='Running',updated_at=now() WHERE id=?", id);
          String verdict = "Accepted", output = "";
          boolean sample = submission.get("mode").equals("run");
          try {
            List<Map<String, Object>> cases = new ArrayList<>();
            cases.add(
                Map.of(
                    "input",
                    submission.get("sample_input"),
                    "expected",
                    submission.get("sample_output")));
            if (!sample)
              cases.addAll(
                  db.queryForList(
                      "SELECT input,expected FROM judge_cases WHERE tenant_id=? AND problem_id=?",
                      submission.get("tenant_id"),
                      submission.get("problem_id")));
            for (var test : cases) {
              var result =
                  client
                      .post()
                      .uri("/submissions?base64_encoded=false&wait=true")
                      .body(
                          Map.of(
                              "language_id",
                              ids.get(submission.get("language")),
                              "source_code",
                              submission.get("source"),
                              "stdin",
                              test.get("input"),
                              "expected_output",
                              test.get("expected"),
                              "cpu_time_limit",
                              2,
                              "wall_time_limit",
                              5,
                              "memory_limit",
                              512000,
                              "max_processes_and_or_threads",
                              32,
                              "max_file_size",
                              128,
                              "enable_network",
                              false))
                      .retrieve()
                      .body(Map.class);
              if (result == null || !(result.get("status") instanceof Map<?, ?> status))
                throw new IllegalStateException("Invalid judge response");
              int code = ((Number) status.get("id")).intValue();
              verdict =
                  switch (code) {
                    case 3 -> "Accepted";
                    case 4 -> "Wrong Answer";
                    case 5 -> "Time Limit Exceeded";
                    case 6 -> "Compilation Error";
                    case 7, 8, 9, 10, 11, 12 -> "Runtime Error";
                    case 14 -> "Memory Limit Exceeded";
                    case 15 -> "Output Limit Exceeded";
                    default -> "Internal Judge Error";
                  };
              if (sample) {
                output =
                    String.valueOf(
                        Optional.ofNullable(result.get("stdout"))
                            .orElse(
                                Optional.ofNullable(result.get("compile_output"))
                                    .orElse(Optional.ofNullable(result.get("stderr")).orElse(""))));
                output = output.substring(0, Math.min(output.length(), 16000));
              }
              if (!verdict.equals("Accepted")) break;
            }
          } catch (Exception e) {
            verdict = "Internal Judge Error";
            output = "Execution service unavailable. No progress or points were awarded.";
          }
          db.update(
              "UPDATE submissions SET verdict=?,output=?,updated_at=now() WHERE id=?",
              verdict,
              sample ? output : "Hidden-case output is private.",
              id);
          if (!sample && verdict.equals("Accepted")) {
            int inserted =
                db.update(
                    "INSERT INTO solved_problems(tenant_id,member_id,problem_id,submission_id)"
                        + " VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
                    submission.get("tenant_id"),
                    submission.get("member_id"),
                    submission.get("problem_id"),
                    id);
            if (inserted > 0)
              db.update(
                  "INSERT INTO point_ledger(id,tenant_id,member_id,problem_id,points) VALUES"
                      + " (?,?,?,?,?)",
                  UUID.randomUUID(),
                  submission.get("tenant_id"),
                  submission.get("member_id"),
                  submission.get("problem_id"),
                  switch (submission.get("difficulty").toString()) {
                    case "Easy" -> 10;
                    case "Medium" -> 20;
                    default -> 30;
                  });
          }
        });
  }
}
