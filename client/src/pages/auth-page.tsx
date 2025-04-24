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
          username,
          password,
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-start justify-center p-8 pt-16">
        <div className="flex flex-col h-full">
          <Card className="w-[450px] flex flex-col h-full">
            <CardHeader className="pt-10 pb-6">
              <CardTitle className="text-2xl">Welcome to ZenCX Studio</CardTitle>
              <CardDescription className="mt-1">
                Login to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
              <form onSubmit={handleAuth} className="flex-grow flex flex-col">
                <div className="space-y-6 flex-grow">
                  <div>
                    <Label htmlFor="username" className="text-base">Username</Label>
                    <Input 
                      id="username" 
                      name="username" 
                      required 
                      placeholder="Enter your username"
                      className="mt-2 py-6"
                    />
                  </div>
                  <div>
                    <Label htmlFor="password" className="text-base">Password</Label>
                    <Input 
                      id="password" 
                      name="password" 
                      type="password" 
                      required 
                      placeholder="Enter your password"
                      className="mt-2 py-6"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full py-6 text-base mt-4"
                  >
                    Login
                  </Button>
                </div>
                <div className="text-center mt-auto pb-8 pt-16">
                  <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot your password?
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="hidden lg:flex bg-white items-start justify-center p-8 pt-16 rounded-none m-0">
        <div className="flex flex-col h-full">
          <div className="max-w-lg">
            <div className="text-center mb-8">
              <ZencxLogo width={240} height={100} className="mx-auto mb-4" />
              <h1 className="text-4xl font-bold mb-4 text-gray-800">
                Transform Your Contact Center Quality and Training
              </h1>
              <p className="text-lg text-gray-600">
                ZenCX Studio helps you create personalized training paths, 
                track agent performance, and ensure compliance with ease.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 mt-16">
              <div className="text-center p-5 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-gray-700">Team Management</h3>
              </div>
              <div className="text-center p-5 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-gray-700">Training Paths</h3>
              </div>
              <div className="text-center p-5 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100">
                <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-gray-700">Quality Monitoring</h3>
              </div>
              <div className="text-center p-5 rounded-lg bg-blue-50/60 shadow-sm border border-blue-100">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <h3 className="font-medium text-gray-700">Analytics</h3>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}