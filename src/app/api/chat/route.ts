import { NextRequest, NextResponse } from "next/server";
import { answerChatQuestion } from "@/lib/openrouter";
import { checkRateLimit, getClientIp } from "@/lib/security";

interface ChatRequestBody {
  question?: string;
  context?: {
    companyName?: string;
    industry?: string | null;
    businessProcesses?: string[];
    agents?: { name: string; priority: number }[];
  };
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту." },
      { status: 429 }
    );
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректное тело запроса." }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "Введите вопрос." }, { status: 400 });
  }

  const answer = await answerChatQuestion({
    question,
    context: {
      companyName: body.context?.companyName ?? "",
      industry: body.context?.industry ?? null,
      businessProcesses: body.context?.businessProcesses ?? [],
      agents: body.context?.agents ?? [],
    },
  });

  return NextResponse.json(answer);
}
