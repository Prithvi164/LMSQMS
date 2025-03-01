import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProcessDetail } from "./process-detail";
import { LocationDetail } from "./location-detail";
import { LobDetail } from "./lob-detail";

export function BatchDetail() {
  const [activeTab, setActiveTab] = useState("lob");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Batch Management Setup</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="lob">Line of Business</TabsTrigger>
              <TabsTrigger value="process">Process</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            <TabsContent value="lob" className="mt-6">
              <LobDetail />
            </TabsContent>
            <TabsContent value="process" className="mt-6">
              <ProcessDetail />
            </TabsContent>
            <TabsContent value="location" className="mt-6">
              <LocationDetail />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}