import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Form schema
const parameterSchema = z.object({
  parameterId: z.number(),
  rating: z.enum(['yes', 'no', 'na']),
  comment: z.string().optional(),
});

const formSchema = z.object({
  parameters: z.array(parameterSchema)
});

type FormData = z.infer<typeof formSchema>;

interface Parameter {
  id: number;
  name: string;
  description: string;
  guidelines?: string;
  weightage: number;
  ratingType: string;
  requiresComment: boolean;
}

interface Pillar {
  id: number;
  name: string;
  description: string;
  parameters: Parameter[];
}

interface Template {
  id: number;
  name: string;
  description: string;
  pillars: Pillar[];
}

export default function EvaluationForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [evaluationId, setEvaluationId] = useState<string>("");

  useEffect(() => {
    // Get evaluation ID from URL
    const id = window.location.pathname.split('/').pop();
    if (id) setEvaluationId(id);
  }, []);

  // Fetch evaluation details 
  const { data: evaluation } = useQuery({
    queryKey: ['/api/evaluations', evaluationId],
    enabled: !!evaluationId,
  });

  // Fetch template details
  const { data: template } = useQuery<Template>({
    queryKey: ['/api/evaluation-templates', evaluation?.templateId],
    enabled: !!evaluation?.templateId,
  });

  // Set up form with default values
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      parameters: template?.pillars.flatMap(pillar => 
        pillar.parameters.map(param => ({
          parameterId: param.id,
          rating: undefined,
          comment: undefined,
        }))
      ) || [],
    }
  });

  // Submit evaluation mutation
  const submitEvaluationMutation = useMutation({
    mutationFn: async (values: FormData) => {
      const response = await fetch(`/api/evaluations/${evaluationId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit evaluation');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Evaluation submitted successfully',
      });
      // Redirect to evaluations list
      window.location.href = '/evaluation-execution';
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    },
  });

  const onSubmit = (values: FormData) => {
    submitEvaluationMutation.mutate(values);
  };

  if (!template || !evaluation) {
    return <div>Loading evaluation form...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Evaluation Form</CardTitle>
          <CardDescription>
            Complete the evaluation by rating each parameter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {template.pillars.map((pillar) => (
                <div key={pillar.id} className="space-y-4">
                  <h3 className="text-lg font-semibold">{pillar.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {pillar.description}
                  </p>

                  {pillar.parameters.map((parameter, paramIndex) => (
                    <FormField
                      key={parameter.id}
                      control={form.control}
                      name={`parameters.${paramIndex}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{parameter.name}</FormLabel>
                          <div className="space-y-2">
                            {parameter.guidelines && (
                              <p className="text-sm text-muted-foreground">
                                {parameter.guidelines}
                              </p>
                            )}
                            <FormControl>
                              <RadioGroup
                                onValueChange={(value) => field.onChange({ 
                                  ...field.value,
                                  parameterId: parameter.id,
                                  rating: value as 'yes' | 'no' | 'na'
                                })}
                                value={field.value?.rating}
                              >
                                <div className="flex space-x-4">
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="yes" id={`${parameter.id}-yes`} />
                                    <label htmlFor={`${parameter.id}-yes`}>Yes</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="no" id={`${parameter.id}-no`} />
                                    <label htmlFor={`${parameter.id}-no`}>No</label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="na" id={`${parameter.id}-na`} />
                                    <label htmlFor={`${parameter.id}-na`}>N/A</label>
                                  </div>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            {parameter.requiresComment && (
                              <FormControl>
                                <Textarea
                                  placeholder="Add your comments here..."
                                  onChange={(e) => field.onChange({ 
                                    ...field.value,
                                    parameterId: parameter.id,
                                    comment: e.target.value
                                  })}
                                  value={field.value?.comment || ''}
                                />
                              </FormControl>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              ))}

              <Button 
                type="submit" 
                className="w-full"
                disabled={submitEvaluationMutation.isPending}
              >
                {submitEvaluationMutation.isPending ? "Submitting..." : "Submit Evaluation"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}