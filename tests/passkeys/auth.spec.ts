import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
test.afterAll(async () => db.$disconnect());
test("real WebAuthn registration, login, backup keys, delayed recovery and replay protection", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const options = {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  } as const;
  let { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  });
  const username = `fixture_${Date.now()}`;
  let loginBody = "",
    loginCookie = "";
  let registrationBody = "",
    registrationCookie = "";
  page.on("request", async (r) => {
    if (
      r.url().endsWith("/api/auth/finish") &&
      r.postData()?.includes('"signature"') &&
      !loginBody
    ) {
      loginBody = r.postData()!;
      loginCookie = (await r.allHeaders()).cookie ?? "";
    }
    if (r.url().endsWith("/api/auth/finish") && !registrationBody) {
      registrationBody = r.postData() ?? "";
      registrationCookie = (await r.allHeaders()).cookie ?? "";
    }
  });
  await page.goto("/register");
  await page.getByLabel("Public username").fill(username);
  await page.getByLabel("Passkey label").fill("Original");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Register passkey" }).click();
  await expect(page.getByRole("heading", { name: username })).toBeVisible();
  const user = await db.user.findUniqueOrThrow({ where: { username } });
  const sessionCookies = await context.cookies();
  const session = sessionCookies.find((c) => c.name === "__Host-gz-session");
  expect(session?.secure).toBe(true);
  expect(session?.httpOnly).toBe(true);
  const replay = await context.request.post("/api/auth/finish", {
    headers: {
      origin: "http://localhost:3102",
      "Content-Type": "application/json",
      cookie: registrationCookie,
    },
    data: registrationBody,
  });
  expect(replay.status()).toBe(400);
  const csrf = await context.request.post("/api/auth/codes", {
    headers: { origin: "https://evil.example" },
    data: {},
  });
  expect(csrf.status()).toBe(400);
  await page
    .getByRole("button", { name: "Generate new recovery codes" })
    .click();
  await expect(page.locator("code")).toHaveCount(8);
  const codes = await page.locator("code").allTextContents();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("/login");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page.getByRole("heading", { name: username })).toBeVisible();
  const loginReplay = await context.request.post("/api/auth/finish", {
    headers: {
      origin: "http://localhost:3102",
      "Content-Type": "application/json",
      cookie: loginCookie,
    },
    data: loginBody,
  });
  expect(loginReplay.status()).toBe(400);
  const freshOptions = await context.request.post("/api/auth/begin", {
    headers: { origin: "http://localhost:3102" },
    data: { purpose: "login" },
  });
  const freshChallenge = (await freshOptions.json()).options.challenge;
  const forged = JSON.parse(loginBody);
  const clientData = JSON.parse(
    Buffer.from(
      forged.response.response.clientDataJSON,
      "base64url",
    ).toString(),
  );
  clientData.challenge = freshChallenge;
  forged.response.response.clientDataJSON = Buffer.from(
    JSON.stringify(clientData),
  ).toString("base64url");
  const forgery = await context.request.post("/api/auth/finish", {
    headers: { origin: "http://localhost:3102" },
    data: forged,
  });
  expect(forgery.status()).toBe(400);
  // Replace the virtual device for backup enrollment, retaining original credential for contest testing.
  const original = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  ({ authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  }));
  await page.getByLabel("Passkey label").fill("Backup");
  await page.getByRole("button", { name: "Add passkey", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove Backup" }),
  ).toBeVisible();
  // Member evidence workflow remains usable without development authentication.
  await page.goto("/claims/new");
  await expect(
    page.getByRole("button", { name: "Submit for review" }),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByRole("button", { name: "Remove Backup" }).click();
  await expect(page.getByRole("button", { name: "Remove Backup" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("/login");
  await page.goto("/recover");
  await page.getByLabel("Public username").fill(username);
  await page.getByLabel("Unused recovery code").fill(codes[0]);
  await page.getByRole("button", { name: "Start recovery" }).click();
  await expect(
    page.getByRole("button", { name: "Enroll replacement passkey" }),
  ).toBeVisible();
  await page.goto("/claims/new");
  await expect(
    page.getByRole("heading", { name: "Local access required" }),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByLabel("Passkey label").fill("Recovered");
  await page
    .getByRole("button", { name: "Enroll replacement passkey" })
    .click();
  await expect(page.getByRole("status")).toContainText("Replacement enrolled");
  const attemptBefore = await db.recoveryAttempt.findFirstOrThrow({
    where: { userId: user.id, active: true },
  });
  // The current virtual device holds only the replacement. No original is used
  // for resumption: this models the reported loss of the original, not macOS UI.
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("/login");
  await page.goto("/recover");
  const resumeRequest = page.waitForRequest((r) =>
    r.url().endsWith("/api/auth/finish"),
  );
  await page
    .getByRole("button", {
      name: "Resume with replacement passkey",
      exact: true,
    })
    .click();
  const resumedRequest = await resumeRequest;
  await expect(
    page.getByRole("heading", { name: "Recovery pending — restricted access" }),
  ).toBeVisible();
  expect(
    (
      await context.request.post("/api/auth/finish", {
        headers: {
          origin: "http://localhost:3102",
          cookie: (await resumedRequest.allHeaders()).cookie ?? "",
        },
        data: resumedRequest.postData(),
      })
    ).status(),
  ).toBe(400);
  for (const operation of ["codes", "cancel", "remove"])
    expect(
      (
        await context.request.post(`/api/auth/${operation}`, {
          headers: { origin: "http://localhost:3102" },
          data: { id: "unavailable" },
        })
      ).status(),
    ).toBe(400);
  await expect(
    page.getByRole("button", { name: "Cancel unauthorized recovery" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enroll replacement passkey" }),
  ).toHaveCount(0);
  await context.clearCookies();
  await page.goto("/recover");
  await page
    .getByRole("button", {
      name: "Resume with replacement passkey",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Recovery pending — restricted access" }),
  ).toBeVisible();
  await expect(page.locator("time")).toHaveCount(2);
  await expect(page.locator("time").nth(0)).toHaveAttribute(
    "dateTime",
    attemptBefore.holdUntil.toISOString(),
  );
  await expect(page.locator("time").nth(1)).toHaveAttribute(
    "dateTime",
    attemptBefore.expiresAt.toISOString(),
  );
  expect(
    await db.recoveryAttempt.findUnique({ where: { id: attemptBefore.id } }),
  ).toEqual(attemptBefore);
  await page.goto("/claims/new");
  await expect(
    page.getByRole("heading", { name: "Local access required" }),
  ).toBeVisible();
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Finish recovery with replacement" })
    .click();
  await expect(page.getByRole("status")).toContainText("delay");
  // Advance database time only in this disposable test; the application has no delay bypass.
  await db.recoveryAttempt.updateMany({
    where: { userId: user.id, active: true },
    data: { holdUntil: new Date(0) },
  });
  await page
    .getByRole("button", { name: "Finish recovery with replacement" })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove Recovered" }),
  ).toBeVisible();
  expect(await db.passkey.count({ where: { userId: user.id } })).toBe(1);
  expect(await db.recoveryCode.count({ where: { userId: user.id } })).toBe(0);
  // Begin another recovery and prove an existing passkey can contest it.
  await page
    .getByRole("button", { name: "Generate new recovery codes" })
    .click();
  await expect(page.locator("code")).toHaveCount(8);
  const newCodes = await page.locator("code").allTextContents();
  const recoveredKeys = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("/login");
  await page.goto("/recover");
  await page.getByLabel("Public username").fill(username);
  await page.getByLabel("Unused recovery code").fill(newCodes[0]);
  await page.getByRole("button", { name: "Start recovery" }).click();
  await expect(
    page.getByRole("button", { name: "Enroll replacement passkey" }),
  ).toBeVisible();
  // Enroll on an independent virtual authenticator so the original remains
  // available to test contest. An expired replacement must not resume.
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  ({ authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  }));
  await page.getByLabel("Passkey label").fill("Cancelled replacement");
  await page
    .getByRole("button", { name: "Enroll replacement passkey" })
    .click();
  await expect(page.getByRole("status")).toContainText("Replacement enrolled");
  const cancelledReplacement = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  // Even after expiry, an original passkey can contest; the restricted session cannot proceed.
  await db.recoveryAttempt.updateMany({
    where: { userId: user.id, active: true },
    data: { expiresAt: new Date(0) },
  });
  const expired = await context.request.post("/api/auth/account", {
    headers: { origin: "http://localhost:3102" },
    data: {},
  });
  expect(expired.status()).toBe(400);
  await context.clearCookies();
  await page.goto("/recover");
  await page
    .getByRole("button", {
      name: "Resume with replacement passkey",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("no longer available");
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  ({ authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  }));
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: recoveredKeys.credentials[0],
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel unauthorized recovery" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel unauthorized recovery" })
    .click();
  await page.waitForURL("/login");
  expect(
    (await db.user.findUniqueOrThrow({ where: { id: user.id } })).accountState,
  ).toBe("ACTIVE");
  expect(await db.recoveryCode.count({ where: { userId: user.id } })).toBe(0);
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  ({ authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  }));
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: cancelledReplacement.credentials[0],
  });
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page.getByRole("status")).toContainText("verification failed");
  // Old pre-recovery credential cannot authenticate after completed recovery.
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
  ({ authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options,
  }));
  await cdp.send("WebAuthn.addCredential", {
    authenticatorId,
    credential: original.credentials[0],
  });
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page.getByRole("status")).toContainText("verification failed");
  expect(recoveredKeys.credentials.length).toBeGreaterThan(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("HTTP throttling returns 429 without blocking other actions or networks", async ({
  playwright,
}) => {
  const client = await playwright.request.newContext({
    baseURL: "http://localhost:3102",
    extraHTTPHeaders: {
      origin: "http://localhost:3102",
      "x-gz-client-ip": "192.0.2.90",
    },
  });
  const other = await playwright.request.newContext({
    baseURL: "http://localhost:3102",
    extraHTTPHeaders: {
      origin: "http://localhost:3102",
      "x-gz-client-ip": "198.51.100.90",
    },
  });
  try {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await client.post("/api/auth/recover", {
            data: { username: "fixture_missing", code: "00".repeat(16) },
          })
        ).status(),
      ).toBe(400);
    const throttled = await client.post("/api/auth/recover", {
      data: { username: "fixture_missing", code: "00".repeat(16) },
    });
    expect(throttled.status()).toBe(429);
    expect(Number(throttled.headers()["retry-after"])).toBeGreaterThan(0);
    expect(
      (
        await client.post("/api/auth/begin", { data: { purpose: "login" } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await other.post("/api/auth/recover", {
          data: { username: "fixture_missing", code: "00".repeat(16) },
        })
      ).status(),
    ).toBe(400);
  } finally {
    await client.dispose();
    await other.dispose();
  }
});
