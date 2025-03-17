import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PreviewFormProps {
  template: any;
}

interface ValidationErrors {
  [key: string]: string;
}

export function PreviewForm({ template }: PreviewFormProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [selectedReasons, setSelectedReasons] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValid, setIsValid] = useState(false);

  if (!template || !template.pillars) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No template data available to preview.
        </AlertDescription>
      </Alert>
    );
  }

  const validateForm = () => {
    const newErrors: ValidationErrors = {};
    let isFormValid = true;

    template.pillars.forEach((pillar: any) => {
      pillar.parameters.forEach((param: any) => {
        // Check if rating is provided
        if (ratings[param.id] === undefined) {
          newErrors[`rating-${param.id}`] = "Rating is required";
          isFormValid = false;
        }

        // Check if reason is selected when "No" is chosen
        if (param.ratingType === "yes_no_na" && 
            ratings[param.id] === 0 && 
            param.noReasons?.length > 0 && 
            !selectedReasons[param.id]) {
          newErrors[`reason-${param.id}`] = "Please select a reason for No";
          isFormValid = false;
        }

        // Check if comment is provided when required
        if ((param.requiresComment || ratings[param.id] === 0) && 
            (!comments[param.id] || comments[param.id].trim() === "")) {
          newErrors[`comment-${param.id}`] = "Comment is required";
          isFormValid = false;
        }
      });
    });

    setErrors(newErrors);
    setIsValid(isFormValid);
    return isFormValid;
  };

  useEffect(() => {
    validateForm();
  }, [ratings, comments, selectedReasons]);

  const handleRatingChange = (parameterId: number, value: string) => {
    const numericValue = parseInt(value);
    setRatings((prev) => ({
      ...prev,
      [parameterId]: numericValue,
    }));
    // Clear selected reason when rating changes from 0
    if (numericValue !== 0) {
      setSelectedReasons((prev) => {
        const newReasons = { ...prev };
        delete newReasons[parameterId];
        return newReasons;
      });
    }
  };

  const handleCommentChange = (parameterId: number, value: string) => {
    setComments((prev) => ({
      ...prev,
      [parameterId]: value,
    }));
  };

  const handleReasonChange = (parameterId: number, reason: string) => {
    setSelectedReasons((prev) => ({
      ...prev,
      [parameterId]: reason,
    }));
    // Also update comments with the selected reason
    setComments((prev) => ({
      ...prev,
      [parameterId]: reason,
    }));
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Will implement submission logic later
      console.log("Form is valid, ready to submit", {
        ratings,
        comments,
        selectedReasons,
      });
    }
  };

  const calculateScore = () => {
    let totalScore = 0;
    let totalWeight = 0;
    let hasFatal = false;

    (template.pillars || []).forEach((pillar: any) => {
      (pillar.parameters || []).forEach((param: any) => {
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
            {(pillar.parameters || []).map((param: any) => (
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
                    ) : param.ratingType === "yes_no_na" ? (
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
                    ) : (
                      <div className="w-full">
                        <p className="text-sm text-muted-foreground">Unsupported rating type</p>
                      </div>
                    )}
                  </div>
                </RadioGroup>
                {errors[`rating-${param.id}`] && (
                  <p className="text-sm text-destructive">{errors[`rating-${param.id}`]}</p>
                )}

                {/* Show reason selection when "No" is selected and noReasons exist */}
                {param.ratingType === "yes_no_na" && ratings[param.id] === 0 && param.noReasons && param.noReasons.length > 0 && (
                  <div className="space-y-2 border rounded-lg p-4 bg-muted/50">
                    <Label className="font-medium">Select Reason for No</Label>
                    <RadioGroup
                      value={selectedReasons[param.id]}
                      onValueChange={(value) => handleReasonChange(param.id, value)}
                    >
                      <div className="space-y-2">
                        {param.noReasons.map((reason: string, index: number) => (
                          <div key={index} className="flex items-center space-x-2">
                            <RadioGroupItem value={reason} id={`${param.id}-reason-${index}`} />
                            <Label htmlFor={`${param.id}-reason-${index}`}>{reason}</Label>
                          </div>
                        ))}
                      </div>
                    </RadioGroup>
                    {errors[`reason-${param.id}`] && (
                      <p className="text-sm text-destructive">{errors[`reason-${param.id}`]}</p>
                    )}
                  </div>
                )}

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
                    {errors[`comment-${param.id}`] && (
                      <p className="text-sm text-destructive">{errors[`comment-${param.id}`]}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end pt-6">
        <Button
          onClick={handleSubmit}
          disabled={!isValid}
          className="w-[200px]"
        >
          Submit Evaluation
        </Button>
      </div>
    </div>
  );
}