import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams } from "wouter";

interface EvaluationData {
  id: number;
  traineeId: number;
  evaluatorId: number;
  templateId: number;
  batchId: number;
  organizationId: number;
  totalScore: number;
  status: string;
  evaluatedAt: string;
  comments?: string;
}

export default function EvaluationForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { id } = useParams();

  // Fetch evaluation data
  const { data: evaluation, isLoading } = useQuery<EvaluationData>({
    queryKey: [`/api/organizations/${user?.organizationId}/evaluations/${id}`],
    enabled: !!user?.organizationId && !!id,
  });

  if (isLoading) {
    return <div>Loading evaluation form...</div>;
  }

  if (!evaluation) {
    return <div>No evaluation found</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Form</CardTitle>
          <CardDescription>
            View and edit evaluation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Status</h3>
              <p>{evaluation.status}</p>
            </div>
            <div>
              <h3 className="font-medium">Total Score</h3>
              <p>{evaluation.totalScore}</p>
            </div>
            <div>
              <h3 className="font-medium">Evaluated At</h3>
              <p>{new Date(evaluation.evaluatedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <h3 className="font-medium">Comments</h3>
              <p>{evaluation.comments || 'No comments'}</p>
            </div>

            {/* Add form fields for editing evaluation */}

            <Button className="w-full">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}