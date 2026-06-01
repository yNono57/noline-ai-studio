import { GeneratorForm } from "@/components/GeneratorForm";
import { Shell } from "@/components/Shell";

type GeneratePageProps = {
  searchParams?: Promise<{ tool?: string }>;
};

export default async function GeneratePage({ searchParams }: GeneratePageProps) {
  const params = await searchParams;

  return (
    <Shell>
      <GeneratorForm initialTool={params?.tool} />
    </Shell>
  );
}
