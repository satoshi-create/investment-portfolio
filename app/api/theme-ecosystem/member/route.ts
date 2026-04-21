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
  /** DB `memo`（短文）。空で NULL */
  memo?: string | null;
  /** 銘柄投入日（観測開始）YYYY-MM-DD */
  observationStartedAt?: string | null;
  memberId?: string;
  /** DB `listing_date`（上場日・YYYY-MM-DD） */
  listingDate?: string | null;
  marketCap?: number | null;
  listingPrice?: number | null;
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
  const memo =
    body.memo === undefined
      ? undefined
      : body.memo == null
        ? null
        : typeof body.memo === "string"
          ? body.memo
          : null;

  let listingDatePatch: string | null | undefined = undefined;
  if (body.listingDate !== undefined) {
    if (body.listingDate === null) {
      listingDatePatch = null;
    } else if (typeof body.listingDate === "string") {
      const parsed = parseOptionalObservationDate(body.listingDate);
      if (parsed === "invalid") {
        return NextResponse.json(
          { error: "上場日（listingDate）は YYYY-MM-DD 形式の有効な日付で指定してください" },
          { status: 400 },
        );
      }
      listingDatePatch = parsed;
    } else {
      return NextResponse.json({ error: "listingDate は文字列または null です" }, { status: 400 });
    }
  }

  let marketCapPatch: number | null | undefined = undefined;
  if (body.marketCap !== undefined) {
    if (body.marketCap === null) {
      marketCapPatch = null;
    } else if (typeof body.marketCap === "number" && Number.isFinite(body.marketCap)) {
      marketCapPatch = body.marketCap;
    } else {
      return NextResponse.json({ error: "marketCap は有限の数値または null です" }, { status: 400 });
    }
  }

  let listingPricePatch: number | null | undefined = undefined;
  if (body.listingPrice !== undefined) {
    if (body.listingPrice === null) {
      listingPricePatch = null;
    } else if (typeof body.listingPrice === "number" && Number.isFinite(body.listingPrice)) {
      listingPricePatch = body.listingPrice;
    } else {
      return NextResponse.json({ error: "listingPrice は有限の数値または null です" }, { status: 400 });
    }
  }

  try {
    await updateEcosystemMember(getDb(), {
      userId,
      themeId,
      memberId,
      role,
      isMajorPlayer,
      companyName,
      memo,
      listingDate: listingDatePatch,
      marketCap: marketCapPatch,
      listingPrice: listingPricePatch,
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
