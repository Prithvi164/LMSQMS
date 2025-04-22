import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
// Use our temporary dashboard configuration component
import { DashboardConfiguration } from "@/components/dashboard/temp-dashboard-configuration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      {/* Main Dashboard with Configurable Widgets */}
      <DashboardConfiguration />
    </div>
  );
}