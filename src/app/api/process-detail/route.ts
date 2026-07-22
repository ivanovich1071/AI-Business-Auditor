import { NextRequest, NextResponse } from "next/server";
import { generateProcessDetail } from "@/lib/openrouter";
import { checkRateLimit, getClientIp } from "@/lib/security";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту." },
      { status: 429 }
    );
  }

  let body: {
    companyName?: string;
    industry?: string | null;
    process?: string;
    departments?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const process = body.process?.trim();
  if (!process) {
    return NextResponse.json({ error: "Не указан бизнес-процесс." }, { status: 400 });
  }

  try {
    const detail = await generateProcessDetail({
      companyName: body.companyName?.trim() || "компания",
      industry: body.industry ?? null,
      process,
      departments: Array.isArray(body.departments) ? body.departments : [],
    });
    return NextResponse.json(detail);
  } catch {
    return NextResponse.json(
      { error: "Не удалось получить детализацию процесса. Попробуйте ещё раз." },
      { status: 502 }
    );
  }
}
