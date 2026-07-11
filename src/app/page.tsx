import { connection } from "next/server";

import { DashboardExplorer } from "@/components/dashboard/DashboardExplorer";
import { getDashboardSnapshot } from "@/lib/dashboard-data";
import { toDashboardData } from "@/lib/dashboard-view";

export default async function Home() {
  await connection();
  const snapshot = await getDashboardSnapshot();
  return <DashboardExplorer initialData={toDashboardData(snapshot)} />;
}
