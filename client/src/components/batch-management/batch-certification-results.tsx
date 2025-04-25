import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocation } from "wouter";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Award, Filter, FileQuestion } from "lucide-react";
import { format } from "date-fns";

type CertificationResult = {
  id: number;
  templateId: number;
  traineeId: number;
  evaluatorId: number;
  finalScore: number;
  evaluationType: string; 
  createdAt: string;
  organizationId: number;
  isPassed: boolean;
  trainee?: {
    fullName: string;
  };
  template?: {
    id: number;
    name: string;
    description: string | null;
  };
};

type BatchCertificationResultsProps = {
  organizationId: number;
  batchId: number;
  filter: "all" | "passed" | "failed";
};

export function BatchCertificationResults({
  organizationId,
  batchId,
  filter,
}: BatchCertificationResultsProps) {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [statusFilter, setStatusFilter] = useState<"all" | "passed" | "failed">(
    filter || "all"
  );
  const [, navigate] = useLocation();

  // Fetch certification evaluations for the selected batch
  const {
    data: certificationResults = [],
    isLoading,
    error,
  } = useQuery<CertificationResult[]>({
    queryKey: [
      `/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`,
      statusFilter !== "all" ? { status: statusFilter } : undefined,
    ],
    queryFn: async ({ queryKey }) => {
      console.log('Query key for certification evaluations:', queryKey);
      // Build the URL with proper query parameters
      const url = new URL(queryKey[0] as string, window.location.origin);
      
      // Add status filter if present
      if (statusFilter !== "all") {
        url.searchParams.append('status', statusFilter);
      }
      
      console.log('Fetching certification evaluations with URL:', url.toString());
      const response = await fetch(url, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch certification evaluations');
      }
      
      return response.json();
    },
    enabled: !!batchId && !!organizationId,
  });

  // Enable debug logging to see data flow
  React.useEffect(() => {
    console.log("Status filter changed to:", statusFilter);
    console.log("Certification evaluations:", certificationResults);
  }, [statusFilter, certificationResults]);

  // Handle view details click
  const handleViewDetails = (evaluationId: number) => {
    navigate(`/evaluations/${evaluationId}`);
  };

  // Handle conduct certification click
  const handleConductCertification = (traineeId: number, traineeName: string) => {
    navigate(`/conduct-evaluation?batchId=${batchId}&traineeId=${traineeId}&traineeName=${encodeURIComponent(traineeName || '')}&evaluationType=certification`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Final Certification Results</CardTitle>
        <CardDescription>
          View certification evaluation results and trainee certification status
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Status Filter:</span>
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              console.log("Changing status filter to:", value);
              setStatusFilter(value as "all" | "passed" | "failed");
              // Force refetch with the new filter
              queryClient.invalidateQueries({ 
                queryKey: [`/api/organizations/${organizationId}/batches/${batchId}/certification-evaluations`] 
              });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Certifications</SelectItem>
              <SelectItem value="passed">Passed Only</SelectItem>
              <SelectItem value="failed">Failed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : certificationResults && certificationResults.length > 0 ? (
          <Table>
            <TableCaption>
              {statusFilter === "all" 
                ? "All certification results" 
                : statusFilter === "passed" 
                  ? "Certifications with passing scores" 
                  : "Certifications with failing scores"}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Trainee</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificationResults.map((result) => {
                const passed = result.isPassed || result.finalScore >= 70;
                return (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">
                      {result.trainee?.fullName || `Trainee ID: ${result.traineeId}`}
                    </TableCell>
                    <TableCell>
                      {result.template?.name || `Template ID: ${result.templateId}`}
                    </TableCell>
                    <TableCell>{result.finalScore}%</TableCell>
                    <TableCell>
                      {format(new Date(result.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {passed ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Passed
                        </Badge>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-800"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(result.id)}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 border rounded-lg bg-muted/10">
            <FileQuestion className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No certification results found</p>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
              {statusFilter === "all"
                ? "No trainees have taken certification evaluations yet"
                : statusFilter === "passed"
                ? "No trainees have passed certification evaluations"
                : "No trainees have failed certification evaluations"}
            </p>
            {hasPermission("manage_trainee_management") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/conduct-evaluation?evaluationType=certification")}
              >
                Conduct Certification
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}