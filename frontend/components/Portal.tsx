"use client";
import {
  useEffect,
  useState,
  useCallback,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Code2,
  BrainCircuit,
  BookOpen,
  FileText,
  MessagesSquare,
  Library,
  Trophy,
  Briefcase,
  Bell,
  Settings,
  ArrowUpRight,
  ArrowRight,
  Search,
  ChevronRight,
  Menu,
  X,
  LogOut,
  Check,
  Clock,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Plus,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { api, auth, initialize, type Profile, type Problem } from "./api";
import Workspace from "./Workspace";
import Assessment from "./Assessment";
type Row = Record<string, any>; // Dynamic server-owned projections; validated request contracts live in the API.
const nav = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/coding", "Coding Lab", Code2],
  ["/aptitude", "Aptitude Lab", BrainCircuit],
  ["/assessments", "Subject Tests", BookOpen],
  ["/resume", "Resume AI", FileText],
  ["/interview", "AI Interview", MessagesSquare],
  ["/materials", "Faculty Resources", Library],
  ["/leaderboard", "Leaderboard", Trophy],
  ["/placement-drives", "Placement Drives", Briefcase],
] as const;
export default function Portal() {
  const pathname = usePathname();
  const path = pathname === "/" ? "/dashboard" : pathname;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [user, setUser] = useState<Profile | null>(null),
    [open, setOpen] = useState(false),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    initialize()
      .then(async (logged) => {
        if (logged) setUser(await api<Profile>("/me"));
        setReady(true);
      })
      .catch((e) => {
        setError(e.message);
        setReady(true);
      });
  }, []);
  const active = nav.find((n) => path.startsWith(n[0]));
  if (!ready)
    return (
      <div className="boot">
        <div className="logo-mark">
          P<span>↗</span>
        </div>
        <h2>Getting your workspace ready…</h2>
        <p>Good things take a little preparation.</p>
      </div>
    );
  return (
    <div
      className="shell"
      style={
        { "--brand": user?.brand_color || "#2563eb" } as React.CSSProperties
      }
    >
      <a className="skip" href="#main">
        Skip to content
      </a>
      <aside className={"sidebar " + (open ? "open" : "")}>
        <Link className="logo" href="/dashboard">
          <span className="logo-mark">
            P<span>↗</span>
          </span>
          <span>
            PlacePrep<span className="ai-badge">AI</span>
          </span>
        </Link>
        <div className="college-badge">
          <span className="college-symbol">
            <GraduationCap size={21} />
          </span>
          <div>
            {user?.college || "Your college workspace"}
            <small>PLACEMENT PREPARATION</small>
          </div>
        </div>
        <p className="nav-caption">YOUR WORKSPACE</p>
        <nav>
          {nav.map(([href, label, Icon]) => (
            <Link
              onClick={() => setOpen(false)}
              className={path.startsWith(href) ? "active" : ""}
              href={href}
              key={href}
            >
              <Icon size={19} />
              {label}
              {href === "/coding" && <span className="nav-new">PRACTICE</span>}
            </Link>
          ))}
          {user &&
            ["FACULTY", "ADMIN", "PLATFORM_ADMIN"].includes(user.role) && (
              <Link className={path === "/admin" ? "active" : ""} href="/admin">
                <ShieldCheck size={19} />
                Faculty & admin
              </Link>
            )}
        </nav>
        <div className="sidebar-end">
          <div className="grow-card">
            <Sparkles size={21} />
            <h3>A little progress. Every day.</h3>
            <p>Your next opportunity starts with what you learn today.</p>
            <Link href="/coding">
              Keep practicing <ArrowUpRight size={16} />
            </Link>
          </div>
          <Link href="/profile" className="user-card">
            <span className="avatar">{user?.name.slice(0, 1) || "S"}</span>
            <span>
              {user?.name || "Your student space"}
              <small>
                {user?.role?.toLowerCase() || "Sign in to get started"}
              </small>
            </span>
            <Settings size={17} />
          </Link>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Close navigation"
          className="scrim"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="content-shell">
        <header className="topbar">
          <div className="crumb">
            <button
              className="icon-button mobile"
              aria-label="Toggle navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>
              {active?.[1] ||
                (path === "/profile" ? "My Profile" : "Management")}
            </strong>
          </div>
          <div className="header-actions">
            <span className="status-dot" />
            <span className="desktop">Learn. Practice. Grow.</span>
            <Link
              href="/notifications"
              className="icon-button"
              aria-label="Announcements"
            >
              <Bell size={19} />
            </Link>
            {user ? (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => auth().logout({ redirectUri: location.origin })}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <button
                className="button compact"
                onClick={() =>
                  auth().login({ redirectUri: location.origin + "/dashboard" })
                }
              >
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {!user ? (
            <Welcome error={error} />
          ) : path.startsWith("/coding/problems/") ? (
            <Workspace slug={decodeURIComponent(path.split("/").pop() || "")} />
          ) : path.startsWith("/attempts/") ? (
            <Assessment id={path.split("/").pop() || ""} />
          ) : (
            <Page
              key={path + version}
              path={path}
              user={user}
              onProfile={setUser}
              reload={reload}
            />
          )}
        </main>
        <footer>
          <span>© {new Date().getFullYear()} PlacePrep AI</span>
          <span>
            Preparation is a journey. Make it yours. <Sparkles size={13} />
          </span>
        </footer>
      </div>
    </div>
  );
}
function Welcome({ error }: { error: string }) {
  return (
    <>
      <Heading
        eyebrow="YOUR FUTURE, IN FOCUS"
        title="Great careers start with great preparation."
        description="One workspace for every step of your placement journey."
      />
      <div className="welcome-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> BUILT FOR YOUR NEXT CHAPTER
          </span>
          <h2>
            Potential is yours.
            <br />
            <em>Let’s make it progress.</em>
          </h2>
          <p>
            Practice with purpose. Build your confidence.
            <br />
            Show up ready for the opportunities ahead.
          </p>
          <button
            className="button white"
            onClick={() =>
              auth().login({ redirectUri: location.origin + "/dashboard" })
            }
          >
            Enter your workspace <ArrowRight size={18} />
          </button>
        </div>
        <HeroArt />
      </div>
      {error && (
        <div className="alert">
          Identity service connection failed: {error}. Start Keycloak using the
          README instructions, then reload.
        </div>
      )}
      <div className="feature-grid">
        {[
          [
            Code2,
            "Practice that makes a difference",
            "Real coding problems, your own saved drafts, and isolated execution when your college connects a judge.",
          ],
          [
            Target,
            "Know where you stand",
            "Timed assessments with saved answers and progress calculated from your actual work.",
          ],
          [
            GraduationCap,
            "Your campus, connected",
            "Learning resources, placement opportunities, and a verified record of your preparation.",
          ],
        ].map(([Icon, title, description], i) => {
          const I = Icon as typeof Code2;
          return (
            <div className="panel feature-card" key={i}>
              <span className="feature-icon">
                <I />
              </span>
              <h3>{title as string}</h3>
              <p>{description as string}</p>
            </div>
          );
        })}
      </div>
      <div className="info-strip">
        <ShieldCheck size={19} />
        <p>
          College-scoped accounts. Private drafts. Verified learning progress.
        </p>
        <button
          className="text-button"
          onClick={() =>
            auth().register({ redirectUri: location.origin + "/dashboard" })
          }
        >
          Create student account <ArrowUpRight size={15} />
        </button>
      </div>
    </>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="description">{description}</p>
      </div>
      {action}
    </div>
  );
}
function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit one" />
      <div className="orbit two" />
      <div className="hero-star">✦</div>
      <div className="hero-chip top">
        <CheckCircle2 size={16} /> One step closer
      </div>
      <div className="stairs">
        <i />
        <i />
        <i>
          <ArrowUpRight size={65} />
        </i>
      </div>
      <div className="hero-chip bottom">
        <Sparkles size={16} /> A future full of possibility
      </div>
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <BookOpen size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api<T>(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return { data, error };
}
function Load({ error }: { error: string }) {
  return error ? (
    <div className="alert" role="alert">
      {error}
    </div>
  ) : (
    <div className="loading">
      <RefreshCw size={20} className="spin" /> Loading your workspace…
    </div>
  );
}
function Page({
  path,
  user,
  onProfile,
  reload,
}: {
  path: string;
  user: Profile;
  onProfile: (u: Profile) => void;
  reload: () => void;
}) {
  if (path === "/dashboard") return <Dashboard user={user} />;
  if (path === "/coding") return <ProblemBank />;
  if (path === "/coding/submissions") return <History />;
  if (path === "/aptitude" || path === "/assessments")
    return <Tests subject={path === "/assessments"} />;
  if (path === "/profile")
    return <ProfilePage user={user} onProfile={onProfile} />;
  if (path === "/materials") return <Materials />;
  if (path === "/resume" || path === "/interview")
    return <AiPage kind={path === "/resume" ? "resume" : "interview"} />;
  if (path === "/leaderboard") return <Leaderboard />;
  if (path === "/placement-drives") return <Drives />;
  if (path === "/notifications") return <Notifications />;
  if (path === "/admin") return <Admin user={user} reload={reload} />;
  return (
    <Empty
      title="This page hasn’t landed yet."
      description="Head back to your workspace."
    >
      <Link className="button" href="/dashboard">
        Go to dashboard
      </Link>
    </Empty>
  );
}
function Dashboard({ user }: { user: Profile }) {
  const { data, error } = useData<Row>("/me/dashboard");
  if (!data) return <Load error={error} />;
  const d = data;
  return (
    <>
      <Heading
        eyebrow="A LITTLE BETTER, EVERY DAY"
        title={`Welcome back, ${user.name.split(" ")[0]}.`}
        description="You bring the ambition. Let’s build the momentum."
        action={
          <Link href="/profile" className="button secondary">
            <Settings size={16} /> My profile
          </Link>
        }
      />
      <div className="welcome-hero dashboard-hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span /> YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h2>
            Small steps today.
            <br />
            <em>Big possibilities tomorrow.</em>
          </h2>
          <p>
            Keep learning, keep building, keep going.
            <br />
            Your future self will thank you.
          </p>
          <Link className="button white" href="/coding">
            Let’s get practicing <ArrowRight size={17} />
          </Link>
        </div>
        <HeroArt />
      </div>
      <div className="stats-grid">
        {[
          [Code2, "Problems solved", d.coding.solved, "Verified unique solves"],
          [
            TrendingUp,
            "Coding points",
            d.coding.points,
            "First accepted solutions only",
          ],
          [
            BrainCircuit,
            "Assessment average",
            `${d.assessments.aptitude}%`,
            "Across completed assessments",
          ],
          [
            CheckCircle2,
            "Tests completed",
            d.assessments.completed,
            "Your learning, on record",
          ],
        ].map(([Icon, label, value, hint], i) => {
          const I = Icon as typeof Code2;
          return (
            <div className="stat-card" key={i}>
              <div>
                <span>{label as string}</span>
                <I size={19} />
              </div>
              <strong>{value as ReactNode}</strong>
              <small>{hint as string}</small>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Your daily launch plan</h2>
              <p>A little structure. A lot of potential.</p>
            </div>
            <span className="soft-tag">START HERE</span>
          </div>
          <div className="plan-list">
            {d.plan.map((p: Row, i: number) => (
              <Link href={p.href} key={p.href}>
                <span className={"plan-icon color-" + i}>
                  {i === 0 ? (
                    <Code2 />
                  ) : i === 1 ? (
                    <BrainCircuit />
                  ) : (
                    <GraduationCap />
                  )}
                </span>
                <span>
                  <strong>{p.title}</strong>
                  <small>
                    {
                      [
                        "Build your problem-solving muscle",
                        "Make your fundamentals stronger",
                        "Put your best self forward",
                      ][i]
                    }
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
          </div>
          <div className="readiness-note">
            <ShieldCheck size={18} />
            <p>{d.readiness.reason}</p>
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <div>
              <h2>Recent activity</h2>
              <p>Your effort adds up.</p>
            </div>
            <Clock size={19} />
          </div>
          {d.activity.length ? (
            d.activity.map((s: Row) => (
              <div className="activity-row" key={s.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{s.title}</strong>
                  <small>
                    {new Date(s.created_at).toLocaleDateString("en-IN")}
                  </small>
                </div>
                <span className="soft-tag">{s.verdict}</span>
              </div>
            ))
          ) : (
            <Empty
              title="A fresh page for your progress."
              description="Your coding activity will appear here after your first real submission."
            />
          )}
        </section>
      </div>
      <div className="info-strip">
        <Sparkles />
        <p>There’s no perfect starting point. There’s just your next step.</p>
        <Link href="/materials">
          Find learning resources <ArrowRight size={16} />
        </Link>
      </div>
    </>
  );
}
function ProblemBank() {
  const [q, setQ] = useState(""),
    [difficulty, setDifficulty] = useState(""),
    [topic, setTopic] = useState(""),
    [page, setPage] = useState(0);
  const { data, error } = useData<{ items: Problem[]; total: number }>(
    `/coding/problems?q=${encodeURIComponent(q)}&difficulty=${difficulty}&topic=${encodeURIComponent(topic)}&page=${page}&size=10`,
  );
  const { data: progress } = useData<Row>("/coding/me/progress");
  return (
    <>
      <Heading
        eyebrow="THINK. BUILD. REPEAT."
        title="Your problem-solving playground."
        description="One challenge at a time. One step closer to interview-ready."
      />
      <div className="coding-intro">
        <span className="intro-icon">
          <Code2 size={34} />
        </span>
        <div>
          <h2>Every solution starts with a little curiosity.</h2>
          <p>
            Explore problems, write real programs, and build skills that stay
            with you.
          </p>
        </div>
        <div className="intro-stat">
          <strong>{progress?.summary.solved || 0}</strong>
          <span>solved</span>
        </div>
        <div className="intro-stat">
          <strong>{progress?.summary.points || 0}</strong>
          <span>verified points</span>
        </div>
      </div>
      <section className="panel bank-panel">
        <div className="section-title">
          <div>
            <h2>
              Problem library <span className="count">{data?.total || 0}</span>
            </h2>
            <p>Find your next challenge.</p>
          </div>
          <Link href="/coding/submissions" className="text-link">
            Submission history <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="filter-row">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search problems"
              placeholder="Search by problem title…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <select
            aria-label="Difficulty"
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All difficulties</option>
            {["Easy", "Medium", "Hard"].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Topic"
            value={topic}
            onChange={(e) => {
              setTopic(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All topics</option>
            {[
              "Arrays",
              "Strings",
              "Binary Search",
              "Dynamic Programming",
              "Graphs",
              "Sorting",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        {!data ? (
          <Load error={error} />
        ) : data.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Problem</th>
                  <th>Difficulty</th>
                  <th>Topic</th>
                  <th>Points</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.solved ? (
                        <CheckCircle2 className="text-green" size={19} />
                      ) : (
                        <span className="unsolved-circle" />
                      )}
                    </td>
                    <td>
                      <Link
                        className="problem-link"
                        href={"/coding/problems/" + p.slug}
                      >
                        {p.title}
                      </Link>
                      <small>stdin / stdout</small>
                    </td>
                    <td>
                      <span
                        className={"difficulty " + p.difficulty.toLowerCase()}
                      >
                        {p.difficulty}
                      </span>
                    </td>
                    <td>
                      <span className="topic-label">{p.topic}</span>
                    </td>
                    <td>
                      {p.difficulty === "Easy"
                        ? 10
                        : p.difficulty === "Medium"
                          ? 20
                          : 30}
                    </td>
                    <td>
                      <Link
                        className="icon-button"
                        aria-label={"Solve " + p.title}
                        href={"/coding/problems/" + p.slug}
                      >
                        <ArrowUpRight size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No problems match just yet."
            description="Try another title or reset your filters."
          />
        )}
        <div className="pagination">
          <span>
            {data?.total || 0} published problems · Page {page + 1}
          </span>
          <div>
            <button
              className="button secondary compact"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary compact"
              disabled={!data || (page + 1) * 10 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <p className="caption">
        <ShieldCheck size={14} /> Points are awarded once per problem, after a
        verified accepted submission. Running sample code never awards points.
      </p>
    </>
  );
}
function Tests({ subject }: { subject: boolean }) {
  const { data, error } = useData<Row[]>("/assessments");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState("");
  async function start(id: string) {
    setBusy(id);
    setMessage("");
    try {
      const result = await api<{ id: string }>(
        `/assessments/${id}/attempts`,
        "POST",
        {},
      );
      location.assign("/attempts/" + result.id);
    } catch (e) {
      setMessage((e as Error).message);
      setBusy("");
    }
  }
  const items = data?.filter((a) =>
    subject ? a.category === "Subject Tests" : a.category !== "Subject Tests",
  );
  return (
    <>
      <Heading
        eyebrow={
          subject ? "KNOW YOUR FUNDAMENTALS" : "MAKE EVERY PRACTICE COUNT"
        }
        title={
          subject
            ? "Strong foundations. Confident answers."
            : "A sharper mind, one question at a time."
        }
        description="Timed practice with server-side scoring, saved answers, and explanations after submission."
      />
      {message && (
        <div role="alert" className="alert">
          {message}
        </div>
      )}
      <div className="feature-grid">
        {!data ? (
          <Load error={error} />
        ) : items?.length ? (
          items.map((a) => (
            <section className="panel assessment-card" key={a.id}>
              <span className="feature-icon">
                <BrainCircuit />
              </span>
              <span className="soft-tag">{a.category}</span>
              <h2>{a.title}</h2>
              <p>Challenge your understanding and learn from every answer.</p>
              <div className="assessment-meta">
                <span>
                  <BookOpen size={16} />
                  {a.questions} questions
                </span>
                <span>
                  <Clock size={16} />
                  {a.duration_minutes} minutes
                </span>
              </div>
              <button
                className="button"
                disabled={busy === a.id}
                onClick={() => start(a.id)}
              >
                {busy === a.id ? "Opening…" : "Start / resume test"}
                <ArrowRight size={16} />
              </button>
            </section>
          ))
        ) : (
          <Empty
            title="Room for more learning."
            description="Your faculty hasn’t published an assessment in this category yet."
          />
        )}
      </div>
    </>
  );
}
function ProfilePage({
  user,
  onProfile,
}: {
  user: Profile;
  onProfile: (u: Profile) => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      onProfile(
        await api<Profile>(
          "/me/profile",
          "PUT",
          Object.fromEntries(new FormData(e.currentTarget)),
        ),
      );
      setMessage("Your profile is up to date.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR PERSONAL LAUNCHPAD"
        title="Let your potential introduce itself."
        description="Keep your profile ready for the right opportunity."
      />
      <div className="profile-layout">
        <section className="panel">
          <h2>Your details</h2>
          <form className="form-stack" onSubmit={save}>
            <label>
              Full name
              <input
                name="name"
                defaultValue={user.name}
                minLength={2}
                maxLength={100}
                required
                autoComplete="name"
              />
            </label>
            <label>
              Email address
              <input value={user.email} disabled readOnly />
            </label>
            <div className="form-row">
              <label>
                Department
                <input
                  name="department"
                  defaultValue={user.department}
                  maxLength={100}
                />
              </label>
              <label>
                Academic batch
                <input
                  name="batch"
                  defaultValue={user.batch}
                  maxLength={30}
                  placeholder="2024–2028"
                />
              </label>
            </div>
            <label>
              Registration number
              <input
                name="registration"
                defaultValue={user.registration}
                maxLength={60}
              />
            </label>
            <label>
              Your skills
              <textarea
                name="skills"
                defaultValue={user.skills}
                maxLength={500}
                rows={4}
                placeholder="Java, Python, SQL…"
              />
            </label>
            <p role="status">{message}</p>
            <button className="button" disabled={busy}>
              Save profile <Check size={17} />
            </button>
          </form>
        </section>
        <aside className="panel profile-summary">
          <span className="large-avatar">{user.name.slice(0, 1)}</span>
          <h2>{user.name}</h2>
          <p>{user.college}</p>
          <span className="soft-tag">{user.role}</span>
          <hr />
          <h3>Academic verification</h3>
          <p>
            {user.academic_verified
              ? `Verified CGPA: ${user.cgpa}`
              : "Your placement team must verify your academic record before eligible drive registration."}
          </p>
          <ShieldCheck size={27} />
        </aside>
      </div>
    </>
  );
}
function Materials() {
  const { data, error } = useData<Row[]>("/materials");
  const [q, setQ] = useState(""),
    [done, setDone] = useState<Record<string, boolean>>({}),
    [message, setMessage] = useState("");
  async function complete(r: Row) {
    const value = !(done[r.id] ?? r.completed);
    try {
      await api("/materials/" + r.id + "/progress", "PUT", {
        completed: value,
      });
      setDone((d) => ({ ...d, [r.id]: value }));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="GOOD KNOWLEDGE. GREAT POSSIBILITIES."
        title="A little guidance goes a long way."
        description="Learning resources published by your college’s faculty."
      />
      <label className="search standalone">
        <Search size={18} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search topics or resources…"
          aria-label="Search resources"
        />
      </label>
      {message && <div className="alert">{message}</div>}
      <div className="feature-grid">
        {!data ? (
          <Load error={error} />
        ) : (
          data
            .filter((r) =>
              (r.title + " " + r.topic).toLowerCase().includes(q.toLowerCase()),
            )
            .map((r) => (
              <article className="panel resource-card" key={r.id}>
                <span className="feature-icon">
                  <Library />
                </span>
                <span className="soft-tag">{r.type}</span>
                <h2>{r.title}</h2>
                <p>
                  {r.topic} · By {r.author}
                </p>
                <a
                  className="text-link"
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open resource <ExternalLink size={15} />
                </a>
                <button
                  className="button secondary"
                  onClick={() => complete(r)}
                >
                  <Check size={16} />
                  {(done[r.id] ?? r.completed) ? "Completed" : "Mark complete"}
                </button>
              </article>
            ))
        )}
      </div>
      {data && !data.length && (
        <Empty
          title="Your next great read is on its way."
          description="Published faculty resources will appear here. No sample links are presented as college materials."
        />
      )}
    </>
  );
}
function Leaderboard() {
  const { data, error } = useData<Row[]>("/leaderboard");
  return (
    <>
      <Heading
        eyebrow="PROGRESS WORTH CELEBRATING"
        title="Show up. Solve. Keep growing."
        description="College rankings based on verified, first-accepted coding solutions."
      />
      <section className="panel">
        {!data ? (
          <Load error={error} />
        ) : data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Department</th>
                  <th>Unique solves</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="rank">#{r.rank}</span>
                    </td>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.department || "—"}</td>
                    <td>{r.solved}</td>
                    <td>
                      <span className="soft-tag">{r.points} pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Be part of the first chapter."
            description="Rankings appear only after verified accepted solutions. No fictional students or scores."
          />
        )}
      </section>
      <p className="caption">
        Ties use earliest points activity, then stable student ID. Only first
        names are shown within your college.
      </p>
    </>
  );
}
function Notifications() {
  const { data, error } = useData<Row[]>("/me/notifications");
  return (
    <>
      <Heading
        eyebrow="FROM YOUR CAMPUS"
        title="Stay in the know."
        description="Updates and announcements from your college team."
      />
      <section className="panel">
        {!data ? (
          <Load error={error} />
        ) : data.length ? (
          data.map((n) => (
            <article className="notice" key={n.id}>
              <span className="feature-icon">
                <Bell size={20} />
              </span>
              <div>
                <small>
                  {new Date(n.created_at).toLocaleDateString("en-IN")}
                </small>
                <h2>{n.title}</h2>
                <p>{n.body}</p>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="You’re all caught up."
            description="Your college announcements will appear here when published."
          />
        )}
      </section>
    </>
  );
}
function Drives() {
  const { data, error } = useData<Row[]>("/placement-drives");
  const [results, setResults] = useState<Record<string, Row>>({}),
    [message, setMessage] = useState("");
  async function check(id: string) {
    try {
      setResults((r) => ({ ...r, [id]: { status: "Checking…" } }));
      const result = await api<Row>(`/placement-drives/${id}/eligibility`);
      setResults((r) => ({ ...r, [id]: result }));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function apply(id: string) {
    try {
      await api(`/placement-drives/${id}/applications`, "POST", {});
      setResults((r) => ({
        ...r,
        [id]: { status: "Applied", reason: "Your registration is saved." },
      }));
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="OPPORTUNITIES, CLOSER TO HOME"
        title="Find where you could go next."
        description="Placement drives published by your campus team, with verified academic eligibility."
      />
      {message && <div className="alert">{message}</div>}
      <div className="feature-grid">
        {!data ? (
          <Load error={error} />
        ) : (
          data.map((d) => (
            <article className="panel drive-card" key={d.id}>
              <span className="company-initial">{d.company.slice(0, 1)}</span>
              <p className="eyebrow">{d.company}</p>
              <h2>{d.title}</h2>
              <p>
                {d.location} · {d.salary}
              </p>
              <div className="drive-details">
                <span>
                  Minimum CGPA <strong>{d.min_cgpa}</strong>
                </span>
                <span>
                  Apply before{" "}
                  <strong>
                    {new Date(d.deadline).toLocaleDateString("en-IN")}
                  </strong>
                </span>
              </div>
              <p>{d.skills}</p>
              {results[d.id] && (
                <p className="eligibility">
                  {results[d.id].status}
                  <small>{results[d.id].reason}</small>
                </p>
              )}
              {d.application_status || results[d.id]?.status === "Applied" ? (
                <span className="soft-tag">
                  {d.application_status || "Applied"}
                </span>
              ) : results[d.id]?.status === "Eligible" ? (
                <button className="button" onClick={() => apply(d.id)}>
                  Register for drive <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  className="button secondary"
                  onClick={() => check(d.id)}
                >
                  Check eligibility <ShieldCheck size={16} />
                </button>
              )}
            </article>
          ))
        )}
      </div>
      {data && !data.length && (
        <Empty
          title="The next opportunity is on its way."
          description="There are no college-published placement drives yet. Employer vacancies are never invented."
        />
      )}
    </>
  );
}
function AiPage({ kind }: { kind: "resume" | "interview" }) {
  const resume = kind === "resume";
  const [report, setReport] = useState<Row | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [nonce, setNonce] = useState(0);
  const { data: history } = useData<Row[]>("/ai/reports?refresh=" + nonce);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const result = await api<Row>(
        resume ? "/ai/resume/analyze" : "/ai/interviews/evaluate",
        "POST",
        {
          text: form.text,
          target: form.target,
          consent: form.consent === "on",
        },
      );
      setReport(result.report);
      setNonce((n) => n + 1);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    try {
      await api("/ai/reports/" + id, "DELETE", {});
      setNonce((n) => n + 1);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow={
          resume
            ? "LET YOUR EXPERIENCE SHINE"
            : "CONFIDENCE COMES WITH PRACTICE"
        }
        title={
          resume
            ? "A stronger story. A clearer next step."
            : "Find the words. Build the confidence."
        }
        description={
          resume
            ? "Educational AI feedback on your resume text, tailored to a target role."
            : "Practice a text interview answer and get constructive educational feedback."
        }
      />
      <div className="profile-layout">
        <section className="panel">
          <h2>
            {resume ? "Review your resume" : "Practice an interview answer"}
          </h2>
          <form className="form-stack" onSubmit={submit}>
            <label>
              {resume
                ? "Target role and job description"
                : "Interview type and question"}
              <textarea
                name="target"
                required
                maxLength={300}
                rows={3}
                placeholder={
                  resume
                    ? "Backend engineer — Java, PostgreSQL, REST APIs…"
                    : "Java technical — Explain how a HashMap works."
                }
              />
            </label>
            <label>
              {resume ? "Resume text" : "Your answer"}
              <textarea
                name="text"
                required
                maxLength={20000}
                rows={12}
                placeholder={
                  resume
                    ? "Paste the text of your resume. Remove personal information you don’t want to share."
                    : "Write your answer here…"
                }
              />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" name="consent" required />I consent to
              sending this text to the configured AI provider and storing the
              generated report in my account.
            </label>
            <p className="caption">
              Do not include sensitive personal data. This is educational
              feedback, not a hiring prediction. You can delete saved reports
              below.
            </p>
            <p className="form-message" role="alert">
              {message}
            </p>
            <button className="button" disabled={busy}>
              {busy ? "Analyzing…" : "Get feedback"} <Sparkles size={17} />
            </button>
          </form>
        </section>
        <section className="panel">
          <h2>Your feedback</h2>
          {report ? (
            <div className="ai-report">
              <span className="soft-tag">AI-GENERATED</span>
              <p>{report.summary}</p>
              {["strengths", "improvements", "nextSteps"].map((k) => (
                <div key={k}>
                  <h3>
                    {k === "nextSteps"
                      ? "Next steps"
                      : k[0].toUpperCase() + k.slice(1)}
                  </h3>
                  <ul>
                    {(report[k] || []).map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Space for your next breakthrough."
              description="Feedback appears after a real provider response. The AI provider must be configured by the platform operator."
            />
          )}
        </section>
      </div>
      <section className="panel report-history">
        <h2>Saved reports</h2>
        {history
          ?.filter((r) => r.kind === kind)
          .map((r) => (
            <div className="application-row" key={r.id}>
              <div>
                <strong>
                  {new Date(r.created_at).toLocaleString("en-IN")}
                </strong>
                <small>{r.kind} feedback</small>
              </div>
              <button
                className="text-button"
                onClick={() => {
                  try {
                    setReport(JSON.parse(r.report));
                  } catch {
                    setMessage("Could not read this report.");
                  }
                }}
              >
                View
              </button>
              <button
                className="text-button danger"
                onClick={() => remove(r.id)}
              >
                Delete
              </button>
            </div>
          ))}
      </section>
    </>
  );
}
function Admin({ user, reload }: { user: Profile; reload: () => void }) {
  const [tab, setTab] = useState("resource"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const admin = ["ADMIN", "PLATFORM_ADMIN"].includes(user.role);
  const { data: students } = useData<Row[]>(
    admin ? "/admin/students" : "/me/notifications",
  );
  const { data: applications } = useData<Row[]>(
    admin ? "/admin/applications" : "/me/notifications",
  );
  if (!["FACULTY", "ADMIN", "PLATFORM_ADMIN"].includes(user.role))
    return (
      <Empty
        title="Your campus team’s workspace."
        description="Faculty or college administrator permissions are required."
      />
    );
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const form = e.currentTarget;
    const d: Row = Object.fromEntries(new FormData(form));
    try {
      if (tab === "resource") await api("/materials", "POST", d);
      if (tab === "notice") await api("/notifications", "POST", d);
      if (tab === "drive")
        await api("/placement-drives", "POST", {
          ...d,
          minCgpa: Number(d.minCgpa),
          deadline: new Date(d.deadline).toISOString(),
        });
      if (tab === "problem") {
        const cases = JSON.parse(d.cases);
        delete d.cases;
        const result = await api<{ id: string }>("/coding/problems", "POST", d);
        await api("/coding/problems/" + result.id + "/publish", "POST", cases);
      }
      if (tab === "assessment")
        await api("/assessments", "POST", {
          title: d.title,
          category: d.category,
          duration: Number(d.duration),
          questions: JSON.parse(d.questions),
        });
      setMessage("Published successfully.");
      form.reset();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    try {
      const d = Object.fromEntries(new FormData(e.currentTarget));
      await api("/admin/students/" + id + "/academic", "PUT", {
        cgpa: Number(d.cgpa),
        verified: true,
      });
      reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  return (
    <>
      <Heading
        eyebrow="HELP BRIGHT FUTURES TAKE OFF"
        title="Your campus, moving forward."
        description="Publish learning content and manage placement preparation."
      />
      <div className="tabs">
        {[
          ["resource", "Learning resource"],
          ["notice", "Announcement"],
          ["problem", "Coding problem"],
          ["assessment", "Assessment"],
          ...(admin ? [["drive", "Placement drive"]] : []),
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={tab === id ? "selected" : ""}
          >
            {label}
          </button>
        ))}
      </div>
      <section className="panel">
        <h2>Publish {tab}</h2>
        <form className="form-stack" onSubmit={save} key={tab}>
          {tab === "resource" ? (
            <>
              <Field label="Title" name="title" />
              <Field label="Topic" name="topic" />
              <label>
                Resource type
                <select name="type">
                  <option>Article</option>
                  <option>Video</option>
                  <option>Notes</option>
                </select>
              </label>
              <Field label="HTTPS resource URL" name="url" type="url" />
            </>
          ) : tab === "notice" ? (
            <>
              <Field label="Title" name="title" />
              <label>
                Announcement
                <textarea name="body" required maxLength={3000} rows={5} />
              </label>
            </>
          ) : tab === "drive" ? (
            <>
              <div className="form-row">
                <Field label="Company" name="company" />
                <Field label="Role" name="title" />
              </div>
              <div className="form-row">
                <Field label="Location" name="location" />
                <Field label="Compensation" name="salary" />
              </div>
              <Field label="Required skills" name="skills" />
              <div className="form-row">
                <label>
                  Minimum CGPA
                  <input
                    name="minCgpa"
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    required
                  />
                </label>
                <Field
                  label="Application deadline"
                  name="deadline"
                  type="datetime-local"
                />
              </div>
            </>
          ) : tab === "assessment" ? (
            <>
              <Field label="Title" name="title" />
              <label>
                Category
                <select name="category">
                  {[
                    "Quantitative Aptitude",
                    "Logical Reasoning",
                    "Verbal Ability",
                    "Subject Tests",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Duration (minutes)
                <input
                  name="duration"
                  type="number"
                  min="1"
                  max="180"
                  required
                />
              </label>
              <label>
                Questions JSON
                <textarea
                  name="questions"
                  rows={8}
                  required
                  placeholder={
                    '[{"prompt":"2 + 2?","options":["1","2","3","4"],"answer":3,"explanation":"Two plus two is four."}]'
                  }
                />
              </label>
              <p className="caption">
                Exactly four options per question. Answer indices are 0–3.
                Published assessments are immutable.
              </p>
            </>
          ) : (
            <>
              <div className="form-row">
                <Field label="Title" name="title" />
                <Field label="Unique URL slug" name="slug" />
              </div>
              <div className="form-row">
                <label>
                  Difficulty
                  <select name="difficulty">
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
                <Field label="Topic" name="topic" />
              </div>
              {[
                ["Statement", "statement"],
                ["Input format", "inputFormat"],
                ["Output format", "outputFormat"],
                ["Constraints", "constraints"],
                ["Sample input", "sampleInput"],
                ["Sample output", "sampleOutput"],
                ["Explanation", "explanation"],
                ["Protected test cases JSON", "cases"],
              ].map(([label, name]) => (
                <label key={name}>
                  {label}
                  <textarea
                    name={name}
                    rows={name === "cases" ? 5 : 2}
                    required
                    placeholder={
                      name === "cases"
                        ? '[{"input":"...","expected":"..."}]'
                        : ""
                    }
                  />
                </label>
              ))}
            </>
          )}
          <p role="status" className="form-message">
            {message}
          </p>
          <button className="button" disabled={busy}>
            {busy ? "Publishing…" : "Publish"} <Plus size={16} />
          </button>
        </form>
      </section>
      {admin && (
        <>
          <section className="panel">
            <h2>Academic verification</h2>
            <p className="description">
              Only verified records are used for placement eligibility. Verify
              against college records before saving.
            </p>
            {students?.length ? (
              students.map((s) => (
                <form
                  className="application-row"
                  key={s.id}
                  onSubmit={(e) => verify(e, s.id)}
                >
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.email}</small>
                  </div>
                  <label className="academic-input">
                    CGPA
                    <input
                      name="cgpa"
                      aria-label={"CGPA for " + s.name}
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      required
                      defaultValue={s.cgpa ?? ""}
                    />
                  </label>
                  <button className="button secondary compact">
                    {s.academic_verified
                      ? "Update verified record"
                      : "Verify record"}
                  </button>
                </form>
              ))
            ) : (
              <p className="description">
                No students have signed into this college yet.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Drive applications</h2>
            {applications?.length ? (
              applications.map((a) => (
                <div className="application-row" key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <small>
                      {a.company} · {a.title}
                    </small>
                  </div>
                  <select
                    aria-label={"Stage for " + a.name}
                    defaultValue={a.status}
                    onChange={async (e) => {
                      try {
                        await api("/admin/applications/" + a.id, "PATCH", {
                          status: e.target.value,
                        });
                        setMessage("Recruitment stage saved.");
                      } catch (err) {
                        setMessage((err as Error).message);
                      }
                    }}
                  >
                    {[
                      "Applied",
                      "Under review",
                      "Interview",
                      "Offer",
                      "Not selected",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ))
            ) : (
              <p className="description">
                Applications will appear after students register for published
                drives.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}
function Field({
  label,
  name,
  type = "text",
}: {
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} maxLength={1000} required />
    </label>
  );
}

function History() {
  const { data, error } = useData<Row[]>("/coding/me/submissions");
  return (
    <>
      <Heading
        eyebrow="YOUR WORK, ON RECORD"
        title="Every attempt is a step forward."
        description="Your own real execution history. Internal judge errors never award or deduct points."
      />
      <section className="panel">
        {!data ? (
          <Load error={error} />
        ) : data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Language</th>
                  <th>Mode</th>
                  <th>Verdict</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.language}</td>
                    <td>{s.mode}</td>
                    <td>
                      <span className="soft-tag">{s.verdict}</span>
                    </td>
                    <td>{new Date(s.created_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Your first attempt is ahead of you."
            description="Once a real judge is connected, your runs and submissions will appear here."
          />
        )}
      </section>
    </>
  );
}
