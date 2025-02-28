import { useState } from "react";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-2xl font-bold mb-4">LMS Application</h1>
      <button 
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        onClick={() => setCount(count + 1)}
      >
        Count: {count}
      </button>
    </div>
  );
}

export default App;