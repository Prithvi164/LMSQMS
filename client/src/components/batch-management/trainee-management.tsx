import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddTraineeForm } from "./add-trainee-form";

export function TraineeManagement() {
  return (
    <Tabs defaultValue="add" className="w-full">
      <TabsList>
        <TabsTrigger value="add">Add Trainee</TabsTrigger>
        <TabsTrigger value="list">Trainee List</TabsTrigger>
      </TabsList>
      <TabsContent value="add">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Add New Trainee</h2>
          <AddTraineeForm />
        </div>
      </TabsContent>
      <TabsContent value="list">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Trainee List</h2>
          {/* We'll implement the trainee list later */}
        </div>
      </TabsContent>
    </Tabs>
  );
}
