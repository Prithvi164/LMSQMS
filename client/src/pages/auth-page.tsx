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

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, user } = useAuth();

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      // Get form data properly
      const username = formData.get("username") as string;
      const password = formData.get("password") as string;
      
      if (username && password) {
        await login({
          username: username.toString(),
          password: password.toString(),
        });
        navigate("/");
      } else {
        throw new Error("Username and password are required");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Logo at top center of the page with subtle background */}
      <div className="flex justify-center items-center py-8 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 shadow-sm">
        <div className="filter drop-shadow-md">
          <ZencxLogo 
            width={280} 
            height={120} 
            className="transition-all duration-200 hover:scale-105" 
          />
        </div>
      </div>
      
      {/* Main content area with subtle separation from logo */}
      <div className="flex-grow grid lg:grid-cols-2 mt-4 px-4">
        <div className="flex items-center justify-center p-4 lg:p-8">
          <div className="flex flex-col justify-center w-full max-w-[400px]">
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle>Welcome to ZenCX Studio</CardTitle>
                <CardDescription>
                  Login to your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAuth}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        name="username" 
                        required 
                        placeholder="Enter your username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input 
                        id="password" 
                        name="password" 
                        type="password" 
                        required 
                        placeholder="Enter your password"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                    >
                      Login
                    </Button>
                    <div className="text-center mt-2">
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

        <div className="hidden lg:flex bg-white items-center justify-center p-8 rounded-lg shadow-sm mx-6 mb-8">
          <div className="flex flex-col justify-center">
            <div className="max-w-lg space-y-8">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4 text-gray-800">
                  Transform Your Contact Center Quality and Training
                </h1>
                <p className="text-lg text-gray-600">
                  ZenCX Studio helps you create personalized training paths, 
                  track agent performance, and ensure compliance with ease.
                </p>
              </div>

              <div className="flex flex-wrap gap-4 mt-8 justify-center">
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32">
                  <Users className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Team Management</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32">
                  <GraduationCap className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Training Paths</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32">
                  <ClipboardCheck className="w-6 h-6 mx-auto mb-1 text-blue-600" />
                  <h3 className="font-medium text-sm text-gray-700">Quality Monitoring</h3>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100 w-32">
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