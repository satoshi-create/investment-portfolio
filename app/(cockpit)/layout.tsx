import { CockpitShell } from "@/src/components/dashboard/CockpitShell";
import { DashboardDataProvider } from "@/src/components/dashboard/DashboardDataContext";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <CockpitShell>{children}</CockpitShell>
    </DashboardDataProvider>
  );
}
