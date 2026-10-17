import Keycloak from "keycloak-js";
let client: Keycloak | undefined;
let initialization: Promise<boolean> | undefined;
export function auth() {
  if (!client)
    client = new Keycloak({
      url: process.env.NEXT_PUBLIC_OIDC_URL || "http://localhost:8081",
      realm: process.env.NEXT_PUBLIC_OIDC_REALM || "placeprep",
      clientId: "placeprep-web",
    });
  return client;
}
export async function initialize() {
  if (!initialization)
    initialization = auth().init({
      onLoad: "check-sso",
      pkceMethod: "S256",
      checkLoginIframe: false,
    });
  return initialization;
}
export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
  key?: string,
): Promise<T> {
  const kc = auth();
  if (!kc.authenticated)
    throw new Error("Sign in to your college account to continue.");
  await kc.updateToken(30);
  const response = await fetch("/api/v1" + path, {
    method,
    headers: {
      Authorization: "Bearer " + kc.token,
      ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status}).`);
  }
  return response.json();
}
export type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
  college: string;
  brand_color: string;
  department: string;
  batch: string;
  registration: string;
  skills: string;
  cgpa: number | null;
  academic_verified: boolean;
};
export type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  topic: string;
  solved: boolean;
  statement: string;
  input_format: string;
  output_format: string;
  constraints_text: string;
  sample_input: string;
  sample_output: string;
  explanation: string;
};
export type Submission = {
  id: string;
  problem_id: string;
  language: string;
  mode: string;
  verdict: string;
  output?: string;
  created_at: string;
  title?: string;
};
