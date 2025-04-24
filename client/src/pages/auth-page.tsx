import { useLocation, Link } from "wouter";
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { ZencxLogo } from "@/components/ui/zencx-logo";
import { BarChart2, Users, GraduationCap, ClipboardCheck } from "lucide-react";
import { useState, useEffect } from "react";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Animation sequence on page load
  useEffect(() => {
    // Show logo first with animation
    setTimeout(() => {
      setIsAnimating(true);
    }, 300);
    
    // Then reveal the form with a fade-in effect
    setTimeout(() => {
      setShowForm(true);
    }, 1000);
  }, []);

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);

    try {
      // Get form data properly
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;
      
      if (username && password) {
        // Add slight delay for animation effect
        setTimeout(async () => {
          try {
            // @ts-ignore - Typescript issue with login params
            await login({
              username: username.toString(),
              password: password.toString(),
            });
            navigate("/");
          } catch (error: any) {
            toast({
              title: "Login failed",
              description: error.message,
              variant: "destructive"
            });
            setIsLoading(false);
          }
        }, 600);
      } else {
        throw new Error("Username and password are required");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className={`absolute rounded-full w-96 h-96 bg-blue-100/20 -top-24 -left-24 transition-all duration-1500 ${isAnimating ? 'opacity-40 scale-100' : 'opacity-0 scale-0'}`}></div>
        <div className={`absolute rounded-full w-64 h-64 bg-blue-100/20 -bottom-12 -right-12 transition-all duration-1500 delay-500 ${isAnimating ? 'opacity-30 scale-100' : 'opacity-0 scale-0'}`}></div>
        <div className={`absolute rounded-full w-32 h-32 bg-blue-100/20 top-1/2 right-1/4 transition-all duration-1500 delay-1000 ${isAnimating ? 'opacity-30 scale-100' : 'opacity-0 scale-0'}`}></div>
      </div>
      
      {/* Main content area */}
      <div className="flex-grow grid lg:grid-cols-2 px-4 py-8 relative z-10">
        <div className="flex items-center justify-center p-4 lg:p-8">
          <div className="flex flex-col justify-center w-full max-w-[400px]">
            <Card className={`shadow-md overflow-hidden border border-slate-100 transition-all duration-700 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              {/* Logo inside the card with subtle background - animated entrance */}
              <div className="flex justify-center pt-8 pb-4 bg-gradient-to-b from-blue-50 to-white border-b border-slate-100 overflow-hidden">
                <div className={`mb-2 px-4 transition-all duration-700 ease-out ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
                  <ZencxLogo 
                    width={180} 
                    height={75} 
                    className="transition-all duration-500 hover:scale-105" 
                  />
                </div>
              </div>
              
              <CardHeader className={`pb-2 pt-0 transition-all duration-500 delay-300 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
                <CardTitle className="text-center">Welcome</CardTitle>
                <CardDescription className="text-center">
                  Login to your account
                </CardDescription>
              </CardHeader>
              <CardContent className={`transition-all duration-500 delay-500 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <form onSubmit={handleAuth}>
                  <div className="space-y-4">
                    <div className="transition-all duration-300 delay-300">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        name="username" 
                        required 
                        placeholder="Enter your username"
                        disabled={isLoading}
                        className="transition-all duration-300"
                      />
                    </div>
                    <div className="transition-all duration-300 delay-400">
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        name="password" 
                        type="password" 
                        required 
                        placeholder="Enter your password"
                        disabled={isLoading}
                        className="transition-all duration-300"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className={`w-full transition-all duration-300 ${isLoading ? 'bg-opacity-80' : ''}`}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Logging in...
                        </div>
                      ) : "Login"}
                    </Button>
                    <div className="text-center mt-2 transition-all duration-300 delay-500">
                      <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                        Forgot your password?
                      </Link>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className={`hidden lg:flex bg-white items-center justify-center p-8 rounded-lg shadow-sm mx-6 mb-8 transition-all duration-1000 delay-300 ${showForm ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
          <div className="flex flex-col justify-center">
            <div className="max-w-lg space-y-8">
              <div className="text-center mb-8">
                <h1 className={`text-4xl font-bold mb-4 text-gray-800 transition-all duration-700 delay-500 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  Transform Your Contact Center Quality and Training
                </h1>
                <p className={`text-lg text-gray-600 transition-all duration-700 delay-700 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                  ZenCX Studio helps you create personalized training paths, 
                  track agent performance, and ensure compliance with ease.
                </p>
              </div>

              <div className={`flex flex-wrap gap-4 mt-8 justify-center transition-all duration-700 delay-900 ${showForm ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <Users className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Team Management</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <GraduationCap className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Training Paths</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <ClipboardCheck className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Quality Monitoring</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32 transition-all duration-500 hover:shadow-md hover:-translate-y-1">
                  <BarChart2 className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Analytics</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}