import { Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <h1 className="text-2xl font-bold p-4">LMS Application</h1>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;