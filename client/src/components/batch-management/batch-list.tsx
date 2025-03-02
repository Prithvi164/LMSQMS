import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function BatchList() {
  const { user } = useAuth();
  
  const { data: batches = [], isLoading } = useQuery({
    queryKey: [`/api/organizations/${user?.organizationId}/batches`],
  });

  if (isLoading) {
    return <div>Loading batches...</div>;
  }

  if (!batches.length) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No batches created yet.
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Process</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Start Date</TableHead>
            <TableHead>End Date</TableHead>
            <TableHead>Capacity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch) => (
            <TableRow key={batch.id}>
              <TableCell>{batch.batchCode}</TableCell>
              <TableCell>{batch.name}</TableCell>
              <TableCell>{batch.process?.name}</TableCell>
              <TableCell>{batch.location?.name}</TableCell>
              <TableCell>{format(new Date(batch.startDate), 'PP')}</TableCell>
              <TableCell>{format(new Date(batch.endDate), 'PP')}</TableCell>
              <TableCell>{batch.capacityLimit}</TableCell>
              <TableCell>
                <Badge
                  variant={
                    batch.status === 'ongoing' 
                      ? 'success' 
                      : batch.status === 'planned' 
                        ? 'secondary' 
                        : 'outline'
                  }
                >
                  {batch.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
