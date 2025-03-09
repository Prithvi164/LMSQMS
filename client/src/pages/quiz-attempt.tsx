import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Question {
  id: number;
  question: string;
  options: string[];
  type: string;
}

interface QuizAttempt {
  id: number;
  questions: number[];
  startTime: string;
  endTime: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

export default function QuizAttemptPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Fetch quiz attempt data
  const { data: attempt, isLoading: attemptLoading } = useQuery<QuizAttempt>({
    queryKey: [`/api/quiz-attempts/${id}`],
  });

  // Fetch questions for this attempt
  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: [`/api/quiz-attempts/${id}/questions`],
    enabled: !!attempt,
  });

  // Timer effect
  useEffect(() => {
    if (!attempt) return;

    const endTime = new Date(attempt.endTime).getTime();
    const updateTimer = () => {
      const now = new Date().getTime();
      const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(timeRemaining);

      if (timeRemaining === 0 && attempt.status === 'in_progress') {
        submitQuiz();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attempt]);

  const submitQuiz = async () => {
    try {
      const response = await fetch(`/api/quiz-attempts/${id}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const result = await response.json();
      window.location.href = `/quiz-result/${id}`;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit quiz. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (attemptLoading || questionsLoading) {
    return <div>Loading quiz...</div>;
  }

  if (!attempt || !questions) {
    return <div>Quiz not found</div>;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
        {timeLeft !== null && (
          <div className="text-lg font-semibold">
            Time Left: {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <Progress value={progress} className="mb-6" />

      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">{currentQuestion.question}</h2>

        <RadioGroup
          value={answers[currentQuestion.id] || ""}
          onValueChange={(value) => {
            setAnswers(prev => ({
              ...prev,
              [currentQuestion.id]: value
            }));
          }}
        >
          {currentQuestion.options.map((option, index) => (
            <div key={index} className="flex items-center space-x-2 mb-4">
              <RadioGroupItem value={option} id={`option-${index}`} />
              <Label htmlFor={`option-${index}`}>{option}</Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button onClick={submitQuiz}>Submit Quiz</Button>
          ) : (
            <Button
              onClick={() => setCurrentQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
            >
              Next
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
