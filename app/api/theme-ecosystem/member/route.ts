import { NextResponse } from "next/server";

import {
  addMemberToEcosystem,
  deleteEcosystemMember,
  EcosystemMemberAuthError,
  EcosystemMemberDuplicateError,
  EcosystemMemberNotFoundError,
  updateEcosystemMember,
} from "@/src/lib/add-ecosystem-member";
import { defaultProfileUserId } from "@/src/lib/authorize-signals";
import { getDb, isDbConfigured } from "@/src/lib/db";
import { fetchCompanyNameForTicker } from "@/src/lib/price-service";

export const dynamic = "force-dynamic";

function parseOptionalObservationDate(raw: unknown): string | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw !== "string") return "invalid";
  const s = raw.trim();
  if (s.length === 0) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "invalid";
  const [y, mo, d] = s.split("-").map((x) => Number(x));
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "invalid";
  return s;
}

type Body = {
  userId?: string;
  themeId?: string;
  ticker?: string;
  role?: string | null;
  isMajorPlayer?: boolean;
  companyName?: string | null;
  /** 銘柄投入日（観測開始）YYYY-MM-DD */
  observationStartedAt?: string | null;
  memberId?: string;
};

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : defaultProfileUserId();
  const themeId = typeof body.themeId === "string" ? body.themeId.trim() : "";
  const ticker = typeof body.ticker === "string" ? body.ticker.trim() : "";
  const role = body.role == null ? null : typeof body.role === "string" ? body.role : null;
  const isMajorPlayer = body.isMajorPlayer === true;
  const companyName =
    body.companyName == null ? null : typeof body.companyName === "string" ? body.companyName.trim() : null;
  const parsedObs = parseOptionalObservationDate(body.observationStartedAt);
  if (parsedObs === "invalid") {
    return NextResponse.json(
      { error: "追加日は YYYY-MM-DD 形式の有効な日付で指定してください" },
      { status: 400 },
    );
  }

  if (!themeId) {
    return NextResponse.json({ error: "themeId is required" }, { status: 400 });
  }
  if (!ticker) {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }

  try {
    const resolvedName = companyName && companyName.length > 0 ? companyName : await fetchCompanyNameForTicker(ticker);
    await addMemberToEcosystem(getDb(), {
      userId,
      themeId,
      ticker,
      role,
      isMajorPlayer,
      companyName: resolvedName,
      observationStartedAt: parsedObs,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EcosystemMemberAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof EcosystemMemberDuplicateError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : defaultProfileUserId();
  const themeId = typeof body.themeId === "string" ? body.themeId.trim() : "";
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!themeId) return NextResponse.json({ error: "themeId is required" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  const role =
    body.role === undefined ? undefined : body.role == null ? null : typeof body.role === "string" ? body.role : null;
  const isMajorPlayer = typeof body.isMajorPlayer === "boolean" ? body.isMajorPlayer : undefined;
  const companyName =
    body.companyName === undefined
      ? undefined
      : body.companyName == null
        ? null
        : typeof body.companyName === "string"
          ? body.companyName
          : null;

  try {
    await updateEcosystemMember(getDb(), {
      userId,
      themeId,
      memberId,
      role,
      isMajorPlayer,
      companyName,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EcosystemMemberAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof EcosystemMemberNotFoundError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 404 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", hint: "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0 ? body.userId.trim() : defaultProfileUserId();
  const themeId = typeof body.themeId === "string" ? body.themeId.trim() : "";
  const memberId = typeof body.memberId === "string" ? body.memberId.trim() : "";
  if (!themeId) return NextResponse.json({ error: "themeId is required" }, { status: 400 });
  if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

  try {
    await deleteEcosystemMember(getDb(), { userId, themeId, memberId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof EcosystemMemberAuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
