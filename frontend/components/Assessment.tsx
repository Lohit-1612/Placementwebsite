"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock, Check, Flag, Send, ArrowLeft, ArrowRight } from "lucide-react";
import { api } from "./api";
type Question = { id: string; prompt: string; options: string[] };
type Result = {
  attempt: { score: number; total: number };
  review: {
    id: string;
    prompt: string;
    answer: number;
    choice: number | null;
    explanation: string;
  }[];
};
type Attempt = {
  attempt: { deadline: string; finalized: boolean };
  questions: Question[];
  answers: { question_id: string; choice: number | null; marked: boolean }[];
  serverTime: string;
};
export default function Assessment({ id }: { id: string }) {
  const [data, setData] = useState<Attempt | null>(null),
    [answers, setAnswers] = useState<
      Record<string, { choice: number | null; marked: boolean }>
    >({}),
    [index, setIndex] = useState(0),
    [seconds, setSeconds] = useState(0),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Answers save when selected"),
    [saving, setSaving] = useState(false),
    [finalizing, setFinalizing] = useState(false);
  const deadline = useRef(0),
    submitted = useRef(false);
  const finish = useCallback(async () => {
    if (submitted.current) return;
    submitted.current = true;
    setFinalizing(true);
    try {
      setResult(await api<Result>("/attempts/" + id + "/submit", "POST", {}));
    } catch (e) {
      setError((e as Error).message);
      submitted.current = false;
    } finally {
      setFinalizing(false);
    }
  }, [id]);
  useEffect(() => {
    api<Attempt>("/attempts/" + id)
      .then(async (d) => {
        setData(d);
        const map: Record<string, { choice: number | null; marked: boolean }> =
          {};
        d.answers.forEach(
          (a) => (map[a.question_id] = { choice: a.choice, marked: a.marked }),
        );
        setAnswers(map);
        deadline.current =
          Date.now() +
          new Date(d.attempt.deadline).getTime() -
          new Date(d.serverTime).getTime();
        setSeconds(
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
        );
        if (d.attempt.finalized) {
          submitted.current = true;
          setResult(await api<Result>("/attempts/" + id + "/result"));
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!data || result) return;
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadline.current - Date.now()) / 1000),
      );
      setSeconds(left);
      if (left === 0) finish();
    }, 1000);
    return () => clearInterval(timer);
  }, [data, result, finish]);
  async function save(q: string, choice: number | null, marked: boolean) {
    setSaving(true);
    setError("");
    const previous = answers[q];
    setAnswers((a) => ({ ...a, [q]: { choice, marked } }));
    try {
      await api(`/attempts/${id}/answers/${q}`, "PUT", { choice, marked });
      setStatus("Saved to server");
    } catch (e) {
      setAnswers((a) => {
        const next = { ...a };
        if (previous) next[q] = previous;
        else delete next[q];
        return next;
      });
      setError((e as Error).message);
      setStatus("Not saved — select your answer again to retry");
    } finally {
      setSaving(false);
    }
  }
  if (result)
    return (
      <>
        <div className="page-heading">
          <div>
            <p className="eyebrow">ONE MORE STEP FORWARD</p>
            <h1>Your results are in.</h1>
            <p className="description">
              Every answer is a chance to learn something.
            </p>
          </div>
          <Link className="button secondary" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
        <div className="result-summary">
          <span className="feature-icon">
            <Check size={30} />
          </span>
          <div>
            <strong>
              {result.attempt.score} / {result.attempt.total}
            </strong>
            <p>
              Correct answers ·{" "}
              {result.attempt.total
                ? Math.round(
                    (result.attempt.score / result.attempt.total) * 100,
                  )
                : 0}
              %
            </p>
          </div>
        </div>
        <section className="panel">
          <h2>Review & learn</h2>
          {result.review.map((q, i) => (
            <article className="answer-review" key={q.id}>
              <span
                className={
                  "soft-tag " + (q.choice === q.answer ? "text-green" : "")
                }
              >
                {q.choice === q.answer
                  ? "Correct"
                  : q.choice === null
                    ? "Unanswered"
                    : "Review this one"}
              </span>
              <h3>
                {i + 1}. {q.prompt}
              </h3>
              <p>{q.explanation}</p>
              <small>
                Correct option: {q.answer + 1} · Your option:{" "}
                {q.choice === null ? "Not answered" : q.choice + 1}
              </small>
            </article>
          ))}
        </section>
      </>
    );
  if (!data)
    return (
      <div className={error ? "alert" : "loading"}>
        {error || "Loading your saved assessment…"}
      </div>
    );
  const q = data.questions[index],
    answer = q ? answers[q.id] : null;
  if (!q) return <div className="alert">This assessment has no questions.</div>;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">FOCUS ON YOUR NEXT ANSWER</p>
          <h1>One question at a time.</h1>
          <p className="description">
            Your answers are saved securely as you go.
          </p>
        </div>
        <span className={"timer " + (seconds < 60 ? "urgent" : "")}>
          <Clock size={20} />
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <div className="assessment-layout">
        <section className="panel question-panel">
          <div className="section-title">
            <span className="soft-tag">
              QUESTION {index + 1} OF {data.questions.length}
            </span>
            <span className="caption">{status}</span>
          </div>
          <h2>{q.prompt}</h2>
          <div className="options">
            {q.options.map((option, i) => (
              <label className={answer?.choice === i ? "chosen" : ""} key={i}>
                <input
                  type="radio"
                  name={q.id}
                  checked={answer?.choice === i}
                  disabled={saving || finalizing || seconds === 0}
                  onChange={() => save(q.id, i, answer?.marked || false)}
                />
                <span className="option-letter">{"ABCD"[i]}</span>
                {option}
              </label>
            ))}
          </div>
          {error && (
            <div role="alert" className="alert">
              {error}
            </div>
          )}
          <button
            className="text-button"
            disabled={saving || finalizing || seconds === 0}
            onClick={() => save(q.id, answer?.choice ?? null, !answer?.marked)}
          >
            <Flag size={16} />
            {answer?.marked ? "Marked for review" : "Mark for review"}
          </button>
          <div className="question-navigation">
            <button
              className="button secondary"
              disabled={index === 0 || saving}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={16} />
              Previous
            </button>
            <button
              className="button"
              disabled={index === data.questions.length - 1 || saving}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next question
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
        <aside className="panel">
          <h3>Your question map</h3>
          <p className="description">Choose a question to jump to it.</p>
          <div className="question-map">
            {data.questions.map((item, i) => (
              <button
                aria-label={"Question " + (i + 1)}
                key={item.id}
                className={
                  (i === index ? "current " : "") +
                  (answers[item.id]?.choice != null ? "answered " : "") +
                  (answers[item.id]?.marked ? "marked" : "")
                }
                disabled={saving}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="caption">
            {Object.values(answers).filter((a) => a.choice != null).length} of{" "}
            {data.questions.length} answered
          </p>
          <div className="readiness-note">
            <Clock size={18} />
            <p>
              Your deadline is enforced by the server, even if you leave or
              reconnect.
            </p>
          </div>
          <button
            className="button full"
            disabled={saving || finalizing}
            onClick={() => {
              if (
                window.confirm(
                  "Submit this assessment? Answers cannot be changed afterward.",
                )
              )
                finish();
            }}
          >
            {finalizing ? "Submitting…" : "Finish assessment"}{" "}
            <Send size={16} />
          </button>
        </aside>
      </div>
    </>
  );
}
