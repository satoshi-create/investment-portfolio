import { CockpitShell } from "@/src/components/dashboard/CockpitShell";
import { DashboardDataProvider } from "@/src/components/dashboard/DashboardDataContext";
import { StoryPanelProvider } from "@/src/components/dashboard/StoryPanelContext";

export default function CockpitLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <StoryPanelProvider>
        <CockpitShell>{children}</CockpitShell>
      </StoryPanelProvider>
    </DashboardDataProvider>
  );
}
