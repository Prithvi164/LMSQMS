import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <h1 className="text-2xl font-bold p-4">LMS Application</h1>
        <p className="p-4">Frontend is now running!</p>
      </div>
    </QueryClientProvider>
  );
}

export default App;