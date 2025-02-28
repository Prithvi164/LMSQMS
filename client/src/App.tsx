import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Route, Switch } from 'wouter';

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Hello, World!</h1>
      <p className="mt-4">Welcome to your React + Express application!</p>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Switch>
          <Route path="/" component={Home} />
        </Switch>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}

export default App;