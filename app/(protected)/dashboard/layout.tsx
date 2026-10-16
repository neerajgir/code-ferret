
import { requiredAuth } from "@/features/auth/actions";
import { DashboardShell } from "@/features/dashboard/components/dashboard-shell";


export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requiredAuth();

  return (
    <DashboardShell user={session.user} plan="Pro">
      {children}
    </DashboardShell>
  );
}