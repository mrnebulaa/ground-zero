import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authService } from "@/lib/passkeys/service";
import {
  assertOrigin,
  AuthError,
  ceremonyCookie,
  cookieOptions,
  sessionCookie,
} from "@/lib/passkeys/config";
const service = authService(db);
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ operation: string }> },
) {
  try {
    assertOrigin(request);
    const reader = request.body?.getReader();
    if (!reader) throw new AuthError("Request body required.");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32768) {
        await reader.cancel();
        throw new AuthError("Request too large.");
      }
      chunks.push(value);
    }
    const input = z
      .record(z.string(), z.unknown())
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const { operation } = await params;
    // Conservative shared pilot budget; no IP/device profiling. Not a public-launch abuse solution.
    await service.rateLimit("auth-global", 120);
    const secret = request.cookies.get(sessionCookie)?.value ?? "";
    let result: { session?: string; binding?: string; [key: string]: unknown };
    if (operation === "begin")
      result = await service.begin(
        z.string().parse(input.purpose),
        input,
        secret,
      );
    else if (operation === "finish")
      result = await service.finish(
        request.cookies.get(ceremonyCookie)?.value ?? "",
        input.response,
        secret,
      );
    else if (operation === "recover")
      result = await service.recover(input.username, input.code);
    else if (operation === "codes") result = await service.codes(secret);
    else if (operation === "remove")
      result = await service.remove(
        secret,
        z.string().max(2048).parse(input.id),
      );
    else if (operation === "cancel") result = await service.cancel(secret);
    else if (operation === "account") result = await service.account(secret);
    else if (operation === "logout") {
      await service.logout(secret, input.all === true);
      result = {};
    } else throw new AuthError("Unknown operation.");
    const { session, binding, ...publicResult } = result;
    const response = NextResponse.json(publicResult, {
      headers: { "Cache-Control": "no-store" },
    });
    if (session)
      response.cookies.set(sessionCookie, session, {
        ...cookieOptions,
        maxAge: 7 * 86400,
      });
    if (binding)
      response.cookies.set(ceremonyCookie, binding, {
        ...cookieOptions,
        maxAge: 300,
      });
    if (operation === "finish")
      response.cookies.set(ceremonyCookie, "", { ...cookieOptions, maxAge: 0 });
    if (operation === "logout" || operation === "cancel")
      response.cookies.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AuthError
            ? error.message
            : "Unable to authenticate. Check the input or start again.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
