import { expect, test } from "@playwright/test";
test("browse, submit, inspect, correct and review with local access", async ({
  page,
}, testInfo) => {
  const title = `Fictional browser fixture ${Date.now()}`;
  await page.goto("/claims/new");
  await expect(
    page.getByRole("heading", { name: "Local access required" }),
  ).toBeVisible();
  await page.goto("/dev-login");
  await page
    .getByLabel("Development secret")
    .fill("local-e2e-only-secret-never-use-for-real-authentication");
  await page.getByRole("button", { name: "Sign in locally" }).click();
  await page.waitForURL("/");
  await page.goto("/claims/new");
  await page.getByLabel("Factual claim or statement").fill(title);
  await page
    .getByLabel("Context, scope and uncertainty")
    .fill("Synthetic browser test. This is not evidence about the real world.");
  const source = page.getByRole("group", { name: "Source attribution" });
  await source
    .getByLabel("Source URL")
    .fill("https://example.org/fictional-browser-fixture");
  await source
    .getByLabel("Title, publisher or author")
    .fill("Fictional source <script>alert(1)</script>");
  await source
    .getByLabel("Relevant passage or explanation")
    .fill("Synthetic source attribution for testing only.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const claimUrl = page.url();
  await expect(
    page.getByRole("heading", {
      name: "Fictional source <script>alert(1)</script>",
    }),
  ).toBeVisible();
  await expect(page.locator("main script")).toHaveCount(0);
  await page.getByText("Publish a correction", { exact: true }).click();
  await page.getByLabel("Claim statement").fill(`${title} corrected`);
  await page
    .getByLabel("Public correction reason")
    .fill("Clarified this fictional test fixture.");
  await page.getByRole("button", { name: "Publish correction" }).click();
  await expect(
    page.getByRole("heading", { name: `${title} corrected`, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await page.goto("/dev-login");
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/");
  await page.goto("/dev-login");
  await page
    .getByLabel("Development secret")
    .fill("local-e2e-only-secret-never-use-for-real-authentication");
  await page.getByLabel("Local test role").selectOption("REVIEWER");
  await page.getByRole("button", { name: "Sign in locally" }).click();
  await page.waitForURL("/");
  await page.goto(claimUrl);
  await page.getByText("Review this claim", { exact: true }).click();
  await page.getByLabel("Review status").selectOption("INSUFFICIENT_EVIDENCE");
  await page
    .getByLabel("Public rationale and limitations")
    .fill("Fictional fixture does not support any real-world conclusion.");
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByText("Version 3", { exact: true })).toBeVisible();
  await page.getByText("Attach another source", { exact: true }).click();
  const addedSource = page.getByRole("group", { name: "Source attribution" });
  await addedSource
    .getByLabel("Source URL")
    .fill("https://example.org/fictional-additional-source");
  await addedSource
    .getByLabel("Title, publisher or author")
    .fill("Additional fictional source");
  await addedSource
    .getByLabel("Relevant passage or explanation")
    .fill("Additional synthetic fixture, not real evidence.");
  await page.getByRole("button", { name: "Attach evidence" }).click();
  await expect(page.getByText("Version 4", { exact: true })).toBeVisible();
  await expect(page.locator(".claim-heading .badge")).toHaveText("Unreviewed");
  await page.screenshot({
    path: testInfo.outputPath("claim-desktop.png"),
    fullPage: true,
  });
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: `${title} corrected`, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("claims-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
