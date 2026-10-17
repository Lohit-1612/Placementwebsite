"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { loader } from "@monaco-editor/react";
import {
  ArrowLeft,
  Play,
  Send,
  Save,
  Clock,
  Code2,
  RefreshCw,
} from "lucide-react";
import { api, type Problem, type Submission } from "./api";
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="loading">Loading code editor…</div>,
});
loader.config({ paths: { vs: "/monaco/vs" } });
const starters: Record<string, string> = {
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        // Read input and print your answer.\n    }\n}\n",
  python:
    'import sys\n\ndef main():\n    data = sys.stdin.read().split()\n    # Read input and print your answer.\n\nif __name__ == "__main__":\n    main()\n',
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // Read input and print your answer.\n    return 0;\n}\n",
  javascript:
    'const fs = require("fs");\nconst input = fs.readFileSync(0, "utf8").trim().split(/\\s+/);\n// Read input and print your answer.\n',
};
export default function Workspace({ slug }: { slug: string }) {
  const [problem, setProblem] = useState<Problem | null>(null),
    [language, setLanguage] = useState("java"),
    [source, setSource] = useState(""),
    [version, setVersion] = useState(0),
    [languages, setLanguages] = useState<
      { id: string; name: string; enabled: boolean }[]
    >([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("Draft not saved"),
    [result, setResult] = useState<Submission | null>(null),
    [history, setHistory] = useState<Submission[]>([]),
    [tab, setTab] = useState("output");
  const dirty = useRef(false),
    pendingKey = useRef<{ fingerprint: string; key: string } | null>(null),
    poll = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    api<Problem>("/coding/problems/" + slug)
      .then(setProblem)
      .catch((e) => setMessage(e.message));
    api<typeof languages>("/coding/languages")
      .then(setLanguages)
      .catch((e) => setMessage(e.message));
    return () => {
      if (poll.current) clearTimeout(poll.current);
    };
  }, [slug]);
  useEffect(() => {
    if (!problem) return;
    let current = true;
    setSource("");
    setSaved("Loading draft…");
    api<{ source: string; version: number }>(
      `/coding/drafts/${problem.id}?language=${language}`,
    )
      .then((d) => {
        if (current) {
          setSource(d.version ? d.source : starters[language]);
          setVersion(d.version);
          dirty.current = false;
          setSaved(d.version ? "Saved draft restored" : "Starter template");
        }
      })
      .catch((e) => {
        if (current) setMessage(e.message);
      });
    return () => {
      current = false;
    };
  }, [problem, language]);
  async function save() {
    if (!problem) return;
    setBusy(true);
    setMessage("");
    try {
      const d = await api<{ version: number }>(
        `/coding/drafts/${problem.id}`,
        "PUT",
        { source, language, version },
      );
      setVersion(d.version);
      dirty.current = false;
      setSaved("Saved just now");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function loadHistory() {
    const all = await api<Submission[]>("/coding/me/submissions");
    setHistory(all.filter((s) => s.problem_id === problem?.id));
  }
  async function watch(id: string) {
    try {
      const s = await api<Submission>("/coding/submissions/" + id);
      setResult(s);
      if (["Queued", "Running"].includes(s.verdict))
        poll.current = setTimeout(() => watch(id), 2000);
      else {
        setBusy(false);
        await loadHistory();
      }
    } catch (e) {
      setBusy(false);
      setMessage((e as Error).message);
    }
  }
  async function execute(mode: string) {
    if (!problem) return;
    setBusy(true);
    setMessage("");
    setTab("output");
    try {
      const fingerprint = JSON.stringify({
        problemId: problem.id,
        source,
        language,
        mode,
      });
      if (pendingKey.current?.fingerprint !== fingerprint)
        pendingKey.current = { fingerprint, key: crypto.randomUUID() };
      const d = await api<{ id: string }>(
        "/coding/" + (mode === "run" ? "runs" : "submissions"),
        "POST",
        { problemId: problem.id, source, language },
        pendingKey.current!.key,
      );
      pendingKey.current = null;
      setResult({
        id: d.id,
        problem_id: problem.id,
        verdict: "Queued",
        language,
        mode,
        created_at: new Date().toISOString(),
      });
      await watch(d.id);
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }
  if (!problem)
    return (
      <div className={message ? "alert" : "loading"}>
        {message || "Loading problem…"}
      </div>
    );
  return (
    <>
      <div className="workspace-heading">
        <Link className="text-link" href="/coding">
          <ArrowLeft size={16} /> All problems
        </Link>
        <div>
          <span className={"difficulty " + problem.difficulty.toLowerCase()}>
            {problem.difficulty}
          </span>
          <span className="topic-label">{problem.topic}</span>
        </div>
      </div>
      <div className="coding-workspace">
        <section className="problem-pane">
          <div className="pane-title">
            <BookIcon /> Problem description
          </div>
          <div className="problem-body">
            <p className="eyebrow">PRACTICE WITH PURPOSE</p>
            <h1>{problem.title}</h1>
            <p>{problem.statement}</p>
            <h3>Input format</h3>
            <p>{problem.input_format}</p>
            <h3>Output format</h3>
            <p>{problem.output_format}</p>
            <h3>Constraints</h3>
            <pre>{problem.constraints_text}</pre>
            <h3>Example</h3>
            <small>INPUT</small>
            <pre>{problem.sample_input}</pre>
            <small>OUTPUT</small>
            <pre>{problem.sample_output}</pre>
            <h3>Explanation</h3>
            <p>{problem.explanation}</p>
            <div className="readiness-note">
              <Code2 size={18} />
              <p>
                Submit a complete program that reads stdin and prints stdout.
                Java programs must use the class name Main.
              </p>
            </div>
          </div>
        </section>
        <section className="editor-pane">
          <div className="editor-toolbar">
            <label>
              <span className="sr-only">Programming language</span>
              <select
                value={language}
                disabled={busy}
                onChange={(e) => {
                  if (
                    dirty.current &&
                    !window.confirm(
                      "Switch language and discard unsaved edits?",
                    )
                  )
                    return;
                  setLanguage(e.target.value);
                }}
              >
                {(languages.length
                  ? languages
                  : Object.keys(starters).map((id) => ({
                      id,
                      name: id,
                      enabled: false,
                    }))
                ).map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="draft-status">{saved}</span>
            <button
              className="icon-button"
              aria-label="Save code draft"
              disabled={busy || !source}
              onClick={save}
            >
              <Save size={17} />
            </button>
          </div>
          <Editor
            height="460px"
            language={language === "cpp" ? "cpp" : language}
            value={source}
            onChange={(value) => {
              setSource(value || "");
              dirty.current = true;
              setSaved("Unsaved changes");
            }}
            theme="vs"
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              padding: { top: 20 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              readOnly: busy,
            }}
          />
          <div className="execution-actions">
            <p>
              <Clock size={14} /> 2s runtime · 512 MB
            </p>
            <button
              className="button secondary compact"
              disabled={busy || !source}
              onClick={() => execute("run")}
            >
              <Play size={15} /> Run samples
            </button>
            <button
              className="button compact"
              disabled={busy || !source}
              onClick={() => execute("submit")}
            >
              <Send size={15} /> Submit
            </button>
          </div>
          <div className="output-pane">
            <div className="tabs">
              <button
                className={tab === "output" ? "selected" : ""}
                onClick={() => setTab("output")}
              >
                Results
              </button>
              <button
                className={tab === "history" ? "selected" : ""}
                onClick={() => {
                  setTab("history");
                  loadHistory().catch((e) => setMessage(e.message));
                }}
              >
                Submission history
              </button>
            </div>
            {message && (
              <p role="alert" className="alert">
                {message}
              </p>
            )}
            {tab === "history" ? (
              history.length ? (
                history.map((s) => (
                  <div className="history-row" key={s.id}>
                    <span
                      className={
                        "verdict " +
                        (s.verdict === "Accepted" ? "accepted" : "")
                      }
                    >
                      {s.verdict}
                    </span>
                    <span>
                      {s.language} · {s.mode}
                    </span>
                    <small>
                      {new Date(s.created_at).toLocaleString("en-IN")}
                    </small>
                  </div>
                ))
              ) : (
                <p className="description">
                  No execution history for this problem yet.
                </p>
              )
            ) : result ? (
              <>
                <div
                  className={
                    "verdict " +
                    (result.verdict === "Accepted" ? "accepted" : "")
                  }
                >
                  {busy && <RefreshCw className="spin" size={16} />}{" "}
                  {result.verdict}
                </div>
                <pre>{result.output || "Waiting for the isolated judge…"}</pre>
              </>
            ) : (
              <p className="description">
                Run code to check the visible sample. Submit to evaluate
                protected test cases. Execution requires a configured isolated
                judge.
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
function BookIcon() {
  return <Code2 size={16} />;
}
