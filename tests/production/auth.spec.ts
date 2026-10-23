import { PrismaClient } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
test("production refuses enabled development login and a correctly signed reviewer cookie", async ({
  page,
  context,
}) => {
  const db = new PrismaClient();
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      displayName: "Fictional production auth fixture",
      role: "REVIEWER",
    },
  });
  try {
    const payload = `${user.id}.${Date.now() + 3600000}`;
    const signature = createHmac(
      "sha256",
      "production-test-secret-never-use-for-real-authentication",
    )
      .update(payload)
      .digest("hex");
    await context.addCookies([
      {
        name: "gz-dev-session",
        value: `${payload}.${signature}`,
        url: "http://127.0.0.1:3101",
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
    await page.goto("/dev-login");
    await expect(
      page.getByRole("heading", {
        name: "Development authentication is disabled",
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Development secret")).toHaveCount(0);
    await page.goto("/claims/new");
    await expect(
      page.getByRole("heading", { name: "Local access required" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit for review" }),
    ).toHaveCount(0);
  } finally {
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
