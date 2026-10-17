import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const accounts = JSON.parse(
  readFileSync(resolve(__dirname, "../../.tools/local-accounts.json"), "utf8"),
);
async function login(page: Page, role = "student") {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Enter your workspace" }).click();
  await page.locator("#username").fill(accounts[role].username);
  await page.locator("#password").fill(accounts[role].password);
  await page.locator("#kc-login").click();
  await expect(
    page.getByRole("heading", { name: /Welcome back/ }),
  ).toBeVisible();
}
test("landing page is responsive and navigation is usable", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", {
      name: "Great careers start with great preparation.",
    }),
  ).toBeVisible();
  await page.screenshot({ path: "/tmp/placeprep-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await expect(page.getByRole("link", { name: "Coding Lab" })).toBeVisible();
  await page.getByRole("link", { name: "Coding Lab" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Great careers start with great preparation.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "/tmp/placeprep-mobile.png", fullPage: true });
});
test("real OIDC login, search, Monaco draft persistence, and profile update", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Coding Lab" }).click();
  await expect(
    page.getByRole("heading", { name: "Your problem-solving playground." }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search problems" }).fill("Sum");
  await expect(
    page.getByRole("link", { name: "Sum of an Array", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Sum of an Array", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sum of an Array", exact: true }),
  ).toBeVisible();
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText(
    "import java.util.*; public class Main { public static void main(String[] args) { Scanner in=new Scanner(System.in);int n=in.nextInt();long sum=0;for(int i=0;i<n;i++)sum+=in.nextLong();System.out.println(sum); } }",
  );
  await page.getByRole("button", { name: "Save code draft" }).click();
  await expect(page.getByText("Saved just now")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saved draft restored")).toBeVisible();
  await page.getByRole("button", { name: "Run samples" }).click();
  await expect(page.locator(".output-pane .verdict")).toHaveText("Accepted", {
    timeout: 120000,
  });
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.locator(".output-pane pre")).toContainText(
    "Hidden-case output is private.",
    { timeout: 120000 },
  );
  await expect(page.locator(".output-pane .verdict")).toHaveText("Accepted");
  await page.screenshot({ path: "/tmp/placeprep-coding.png", fullPage: true });
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Your details" }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your skills" })
    .fill("Java, PostgreSQL, TypeScript");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("up to date");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Your skills" })).toHaveValue(
    "Java, PostgreSQL, TypeScript",
  );
});
test("assessment saves across reload and scores server-side", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("link", { name: "Aptitude Lab" }).click();
  const card = page.locator(".assessment-card").filter({
    has: page.getByRole("heading", { name: "Quantitative Foundations" }),
  });
  await card.getByRole("button", { name: "Start / resume test" }).click();
  await expect(
    page.getByRole("heading", { name: "One question at a time." }),
  ).toBeVisible();
  const firstChoice = (await page.getByRole("radio").nth(1).isChecked())
    ? 0
    : 1;
  await page.getByRole("radio").nth(firstChoice).check();
  await expect(page.getByText("Saved to server")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio").nth(firstChoice)).toBeChecked();
  await page.getByRole("button", { name: "Next question" }).click();
  const secondChoice = (await page.getByRole("radio").nth(2).isChecked())
    ? 3
    : 2;
  await page.getByRole("radio").nth(secondChoice).check();
  await expect(page.getByText("Saved to server")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Finish assessment" }).click();
  await expect(
    page.getByRole("heading", { name: "Your results are in." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review & learn" }),
  ).toBeVisible();
});
test("faculty publishes a persistent resource", async ({ page }) => {
  await login(page, "faculty");
  await page.getByRole("link", { name: "Faculty & admin" }).click();
  const title = "Learning resource " + Date.now();
  await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
  await page.getByRole("textbox", { name: "Topic", exact: true }).fill("Java");
  await page
    .getByRole("textbox", { name: "HTTPS resource URL" })
    .fill("https://docs.oracle.com/en/java/");
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Published successfully",
  );
  await page.getByRole("link", { name: "Faculty Resources" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Mark complete" }).last().click();
  await expect(
    page.getByRole("button", { name: "Completed" }).last(),
  ).toBeVisible();
});
test("college admin verifies academics, publishes a drive, and student registers", async ({
  page,
  browser,
}) => {
  await login(page, "admin");
  await page.getByRole("link", { name: "Faculty & admin" }).click();
  const record = page
    .locator("form.application-row")
    .filter({ hasText: accounts.student.username + "@test.invalid" });
  await record.getByRole("spinbutton").fill("8.5");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/academic") &&
        r.request().method() === "PUT" &&
        r.status() === 200,
    ),
    record.getByRole("button").click(),
  ]);
  await expect(
    page
      .locator("form.application-row")
      .filter({ hasText: accounts.student.username + "@test.invalid" })
      .getByRole("button"),
  ).toHaveText("Update verified record");
  await page
    .getByRole("button", { name: "Placement drive", exact: true })
    .click();
  const title = "Verified drive " + Date.now();
  await page
    .getByRole("textbox", { name: "Company", exact: true })
    .fill("Browser Test Employer");
  await page.getByRole("textbox", { name: "Role", exact: true }).fill(title);
  await page
    .getByRole("textbox", { name: "Location", exact: true })
    .fill("Remote");
  await page
    .getByRole("textbox", { name: "Compensation", exact: true })
    .fill("As published by campus");
  await page
    .getByRole("textbox", { name: "Required skills" })
    .fill("Java, SQL");
  await page.getByRole("spinbutton", { name: "Minimum CGPA" }).fill("7");
  await page
    .getByLabel("Application deadline")
    .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "Published successfully",
  );
  const context = await browser.newContext();
  const student = await context.newPage();
  await login(student);
  await student.getByRole("link", { name: "Placement Drives" }).click();
  const card = student.locator(".drive-card").filter({
    has: student.getByRole("heading", { name: title, exact: true }),
  });
  await card.getByRole("button", { name: "Check eligibility" }).click();
  await expect(card.locator(".eligibility")).toContainText("Eligible");
  await card.getByRole("button", { name: "Register for drive" }).click();
  await expect(card.getByText("Applied", { exact: true })).toBeVisible();
  await page.reload();
  const application = page
    .locator(".application-row")
    .filter({ hasText: title });
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes("/admin/applications/") &&
        r.request().method() === "PATCH" &&
        r.status() === 200,
    ),
    application.getByRole("combobox").selectOption("Interview"),
  ]);
  await student.reload();
  await expect(
    student
      .locator(".drive-card")
      .filter({
        has: student.getByRole("heading", { name: title, exact: true }),
      })
      .getByText("Interview", { exact: true }),
  ).toBeVisible();
  await context.close();
});
