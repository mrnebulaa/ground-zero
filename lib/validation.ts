import { z } from "zod";
export const statuses = [
  "UNREVIEWED",
  "UNDER_REVIEW",
  "SUPPORTED",
  "DISPUTED",
  "REFUTED",
  "INSUFFICIENT_EVIDENCE",
] as const;
export const kinds = [
  "FACTUAL",
  "INTERPRETATION",
  "OPINION",
  "UNKNOWN",
] as const;
export const relations = ["SUPPORTS", "CHALLENGES", "CONTEXT"] as const;
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine(
      (value) => !value.includes("\0"),
      "Null characters are not allowed.",
    );
export const sourceUrl = text(1, 2048).transform((value, ctx) => {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.href.length > 2048
    )
      throw new Error();
    return url.href;
  } catch {
    ctx.addIssue({
      code: "custom",
      message:
        "Use an HTTP(S) source URL without embedded credentials, at most 2048 characters after URL encoding.",
    });
    return z.NEVER;
  }
});
export const sourceInput = z.object({
  url: sourceUrl,
  attribution: text(3, 300),
  note: text(10, 3000),
  relation: z.enum(relations),
});
export const claimInput = z
  .object({
    title: text(10, 240),
    description: text(20, 10000),
    kind: z.enum(kinds),
    sources: z.array(sourceInput).min(1).max(10),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.sources.map((s) => s.url)).size !== value.sources.length)
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Each source URL must be unique.",
      });
  });
export const revisionInput = z.object({
  title: text(10, 240),
  description: text(20, 10000),
  kind: z.enum(kinds),
  reason: text(10, 2000),
  version: z.coerce.number().int().positive(),
});
export const reviewInput = z.object({
  status: z.enum(statuses),
  reason: text(10, 2000),
  version: z.coerce.number().int().positive(),
});
export const idInput = text(1, 100);
