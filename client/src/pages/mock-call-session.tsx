import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

interface MockCallSessionProps {
  params: {
    id: string;
  };
}

interface ScenarioType {
  id: number;
  title: string;
  customerProfile: {
    name: string;
    background: string;
    personality: string;
    concerns: string[];
  };
  expectedDialogue: {
    greeting: string;
    keyPoints: string[];
    resolutions: string[];
    closingStatements: string[];
  };
}

export default function MockCallSessionPage({ params }: MockCallSessionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);

  const { data: attempt, isLoading } = useQuery({
    queryKey: [`/api/mock-call-attempts/${params.id}`],
    enabled: !!params.id,
  });

  const { data: scenario } = useQuery<ScenarioType>({
    queryKey: [`/api/mock-call-scenarios/${attempt?.scenarioId}`],
    enabled: !!attempt?.scenarioId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{scenario?.title}</span>
              <Badge variant="outline">{isRecording ? "Recording" : "Ready"}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2">Customer Profile</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Name:</strong> {scenario?.customerProfile.name}</p>
                <p><strong>Background:</strong> {scenario?.customerProfile.background}</p>
                <p><strong>Personality:</strong> {scenario?.customerProfile.personality}</p>
                <div>
                  <strong>Concerns:</strong>
                  <ul className="list-disc list-inside">
                    {scenario?.customerProfile.concerns.map((concern, index) => (
                      <li key={index}>{concern}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Expected Dialogue</h3>
              <div className="bg-muted p-4 rounded-lg">
                <p><strong>Greeting:</strong> {scenario?.expectedDialogue.greeting}</p>
                <div className="mt-2">
                  <strong>Key Points:</strong>
                  <ul className="list-disc list-inside">
                    {scenario?.expectedDialogue.keyPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={() => setIsRecording(!isRecording)}
                variant={isRecording ? "destructive" : "default"}
              >
                {isRecording ? "Stop Recording" : "Start Recording"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}