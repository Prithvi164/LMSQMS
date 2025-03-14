import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

interface CountdownTimerProps {
  endTime: Date;
  onTimeExpired: () => void;
  warningThresholds?: number[]; // in seconds
}

export function CountdownTimer({ 
  endTime, 
  onTimeExpired,
  warningThresholds = [300, 60] // 5 minutes and 1 minute by default
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      return Math.max(0, Math.floor((end - now) / 1000));
    };

    // Initialize time left
    setTimeLeft(calculateTimeLeft());

    // Update timer every second
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      // Check warning thresholds
      if (warningThresholds.includes(remaining)) {
        toast({
          title: "Time Warning",
          description: `${remaining / 60} minutes remaining!`,
          variant: "destructive",
        });
      }

      // Check if time expired
      if (remaining === 0) {
        clearInterval(timer);
        onTimeExpired();
      }
    }, 1000);

    // Cleanup
    return () => clearInterval(timer);
  }, [endTime, onTimeExpired, warningThresholds]);

  // Format time for display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (hrs > 0) parts.push(`${hrs}h`);
    if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
  };

  // Style based on time remaining
  const getTimerStyle = () => {
    if (timeLeft <= 60) return "text-red-500 animate-pulse";
    if (timeLeft <= 300) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <div className="fixed top-4 right-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 rounded-lg shadow-lg border flex items-center gap-2">
      <AlertCircle className="h-4 w-4" />
      <span className={`font-mono text-lg ${getTimerStyle()}`}>
        {formatTime(timeLeft)}
      </span>
    </div>
  );
}
