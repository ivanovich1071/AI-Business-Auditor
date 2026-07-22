"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/types/analysis";
import { CompanyAudit } from "./CompanyAudit";
import { AgentsList } from "./AgentsList";
import { ChatPanel } from "./ChatPanel";

/**
 * The 3-equal-columns results layout shared by the home page and the company
 * detail page: (1) business-process audit + department filter, (2) AI agents,
 * (3) chat. Department selection is shared and filters columns 1 and 2.
 */
export function ResultsGrid({ result }: { result: AnalysisResult }) {
  const [department, setDepartment] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:[height:70vh]">
      <CompanyAudit result={result} department={department} onDepartmentChange={setDepartment} />
      <AgentsList result={result} department={department} />
      <ChatPanel result={result} />
    </div>
  );
}
