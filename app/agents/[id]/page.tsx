import { AgentDetailView } from "@/components/AgentDetailView";
import { Shell } from "@/components/Shell";
import { getOfficialAgent } from "@/lib/official-agents";

export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const officialAgent = getOfficialAgent(id);

  return (
    <Shell>
      <AgentDetailView officialAgent={officialAgent} customAgentId={officialAgent ? undefined : id} />
    </Shell>
  );
}
