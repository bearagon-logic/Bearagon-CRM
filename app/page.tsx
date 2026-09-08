import { redirect } from "next/navigation";
import { WorkQueue } from "@/components/work-queue";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  // Retain old account creation/filter bookmarks during adoption.
  if (["newAccount", "stage", "sales", "q"].some(key => params.has(key))) redirect(`/companies?${params}`);
  return <WorkQueue />;
}
