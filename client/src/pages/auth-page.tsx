import { useState } from "react";
import { useLocation } from "wouter";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { type LoginData } from "@/hooks/use-auth";
import { type InsertUser } from "@shared/schema";
import { SiOpenai } from "react-icons/si";
import { BarChart2, Users, GraduationCap } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login, register, user } = useAuth();

  // Redirect if already logged in
  if (user) {
    navigate("/");
    return null;
  }

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      if (isLogin) {
        const loginData: LoginData = {
          username: formData.get("username") as string,
          password: formData.get("password") as string,
        };
        await login(loginData);
      } else {
        const registrationData: InsertUser = {
          username: formData.get("username") as string,
          password: formData.get("password") as string,
          email: formData.get("email") as string,
          fullName: formData.get("fullName") as string,
          role: "user",
          active: true,
          certified: false,
        };
        await register(registrationData);
      }
      navigate("/");
    } catch (error: any) {
      toast({
        title: isLogin ? "Login failed" : "Registration failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Welcome to CloudLMS</CardTitle>
            <CardDescription>
              {isLogin ? 
                "Login to your account" : 
                "Register a new account"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth}>
              <div className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input 
                        id="fullName" 
                        name="fullName" 
                        required 
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input 
                        id="email" 
                        name="email" 
                        type="email"
                        required 
                        placeholder="Enter your work email"
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input 
                    id="username" 
                    name="username" 
                    required 
                    placeholder={isLogin ? "Enter your username" : "Choose a username"}
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
                {!isLogin && (
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input 
                      id="confirmPassword" 
                      name="confirmPassword" 
                      type="password" 
                      required 
                      placeholder="Re-enter your password"
                    />
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full"
                >
                  {isLogin ? "Login" : "Register"}
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? "Register here" : "Login here"}
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="hidden lg:flex bg-muted items-center justify-center p-8">
        <div className="max-w-lg space-y-8">
          <div className="text-center mb-8">
            <SiOpenai className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h1 className="text-4xl font-bold mb-4">
              Transform Your Contact Center Training
            </h1>
            <p className="text-lg text-muted-foreground">
              CloudLMS helps you create personalized learning paths, 
              track agent performance, and ensure compliance with ease.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-medium">Team Management</h3>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <GraduationCap className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-medium">Learning Paths</h3>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 text-primary" />
              <h3 className="font-medium">Analytics</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}