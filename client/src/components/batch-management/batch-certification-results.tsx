import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Loader2, CheckCircle, XCircle, Award, Filter } from "lucide-react";
import { format } from "date-fns";

type CertificationResult = {
  id: number;
  traineeId: number;
  score: number;
  templateId: number;
  evaluatedAt: string;
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
      statusFilter,
    ],
    enabled: !!batchId && !!organizationId,
  });

  // Handle view details click
  const handleViewDetails = (evaluationId: number) => {
    navigate(`/evaluations/${evaluationId}`);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Certification Results</CardTitle>
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
            <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-destructive">
            <p>Error loading certification results</p>
            <p className="text-sm text-muted-foreground">
              Please try again later
            </p>
          </div>
        ) : certificationResults.length === 0 ? (
          <div className="text-center py-8 border rounded-lg bg-muted/20">
            <Award className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
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
                onClick={() => navigate("/conduct-evaluation")}
              >
                Conduct Certification
              </Button>
            )}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trainee Name</TableHead>
                  <TableHead>Certification Template</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificationResults.map((result) => {
                  // Determine if passed based on score (70 is default passing score)
                  const passed = result.isPassed || result.score >= 70;
                  
                  return (
                    <TableRow key={result.id}>
                      <TableCell className="font-medium">
                        {result.trainee?.fullName || `Trainee ID: ${result.traineeId}`}
                      </TableCell>
                      <TableCell>
                        {result.template?.name || `Template ID: ${result.templateId}`}
                      </TableCell>
                      <TableCell className="text-center">{result.score}%</TableCell>
                      <TableCell className="text-center">
                        {passed ? (
                          <Badge
                            className="bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-400 dark:hover:bg-green-900/60"
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Passed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-400 dark:hover:bg-red-900/60 border-red-300 dark:border-red-800"
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {format(new Date(result.evaluatedAt), "MMM d, yyyy")}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}