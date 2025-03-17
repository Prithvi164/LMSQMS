import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface PreviewFormProps {
  template: any;
}

export function PreviewForm({ template }: PreviewFormProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [hasErrors, setHasErrors] = useState(false);

  const handleRatingChange = (parameterId: number, value: string) => {
    setRatings((prev) => ({
      ...prev,
      [parameterId]: parseInt(value),
    }));
  };

  const handleCommentChange = (parameterId: number, value: string) => {
    setComments((prev) => ({
      ...prev,
      [parameterId]: value,
    }));
  };

  const calculateScore = () => {
    let totalScore = 0;
    let totalWeight = 0;
    let hasFatal = false;

    template.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        const rating = ratings[param.id];
        if (rating !== undefined) {
          if (param.isFatal && rating === 0) {
            hasFatal = true;
          }
          totalScore += (rating * param.weightage * pillar.weightage) / 100;
          totalWeight += param.weightage * pillar.weightage / 100;
        }
      });
    });

    return {
      score: totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0,
      hasFatal,
    };
  };

  const { score, hasFatal } = calculateScore();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{template.name}</h2>
        <Badge variant={hasFatal ? "destructive" : "default"}>
          Score: {score.toFixed(2)}%
        </Badge>
      </div>

      {hasFatal && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Fatal error detected. This evaluation will be marked as failed.
          </AlertDescription>
        </Alert>
      )}

      {template.pillars.map((pillar: any) => (
        <Card key={pillar.id}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{pillar.name}</CardTitle>
              <Badge variant="outline">{pillar.weightage}%</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {pillar.parameters.map((param: any) => (
              <div key={param.id} className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Label className="text-base">
                      {param.name}
                      {param.isFatal && (
                        <Badge variant="destructive" className="ml-2">
                          Fatal
                        </Badge>
                      )}
                    </Label>
                    {param.description && (
                      <p className="text-sm text-muted-foreground">
                        {param.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{param.weightage}%</Badge>
                </div>

                {param.guidelines && (
                  <Alert>
                    <AlertDescription>{param.guidelines}</AlertDescription>
                  </Alert>
                )}

                <RadioGroup
                  value={ratings[param.id]?.toString()}
                  onValueChange={(value) => handleRatingChange(param.id, value)}
                >
                  <div className="flex justify-between max-w-[400px]">
                    {param.ratingType === "numeric" ? (
                      Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <RadioGroupItem value={i.toString()} id={`${param.id}-${i}`} />
                          <Label htmlFor={`${param.id}-${i}`}>{i}</Label>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="0" id={`${param.id}-no`} />
                          <Label htmlFor={`${param.id}-no`}>No</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="1" id={`${param.id}-yes`} />
                          <Label htmlFor={`${param.id}-yes`}>Yes</Label>
                        </div>
                      </>
                    )}
                  </div>
                </RadioGroup>

                {(param.requiresComment || ratings[param.id] === 0) && (
                  <div className="space-y-2">
                    <Label>
                      Comments
                      {param.requiresComment && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Textarea
                      value={comments[param.id] || ""}
                      onChange={(e) =>
                        handleCommentChange(param.id, e.target.value)
                      }
                      placeholder="Enter your comments here..."
                    />
                  </div>
                )}

                {param.noReasons && param.noReasons.length > 0 && ratings[param.id] === 0 && (
                  <div className="space-y-2">
                    <Label>Reason for No</Label>
                    <RadioGroup
                      value={comments[param.id]}
                      onValueChange={(value) => handleCommentChange(param.id, value)}
                    >
                      {param.noReasons.map((reason: string, index: number) => (
                        <div key={index} className="flex items-center space-x-2">
                          <RadioGroupItem value={reason} id={`${param.id}-reason-${index}`} />
                          <Label htmlFor={`${param.id}-reason-${index}`}>{reason}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
