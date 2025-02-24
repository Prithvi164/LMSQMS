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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [passwordMatch, setPasswordMatch] = useState(true);
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

    // For registration, check if passwords match
    if (!isLogin) {
      const password = formData.get("password") as string;
      const confirmPassword = formData.get("confirmPassword") as string;

      if (password !== confirmPassword) {
        setPasswordMatch(false);
        toast({
          title: "Password Mismatch",
          description: "The passwords you entered do not match.",
          variant: "destructive"
        });
        return;
      }
    }

    try {
      if (isLogin) {
        await login({
          username: formData.get("email") as string, // Use email as username
          password: formData.get("password") as string,
        });
      } else {
        await register({
          username: formData.get("email") as string, // Use email as username
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          organizationName: formData.get("organizationName") as string,
        });
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
    <div className="min-h-screen grid grid-cols-2">
      <div className="flex items-center justify-center p-8">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Welcome to CloudLMS</CardTitle>
            <CardDescription>
              {isLogin ? 
                "Login to your account" : 
                "Register a new organization"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth}>
              <div className="space-y-4">
                {!isLogin && (
                  <div>
                    <Label htmlFor="organizationName">Organization Name</Label>
                    <Input 
                      id="organizationName" 
                      name="organizationName" 
                      required 
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email"
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
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
                      className={!passwordMatch ? "border-red-500" : ""}
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
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setPasswordMatch(true);
                    }}
                  >
                    {isLogin ? "Register here" : "Login here"}
                  </button>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <div 
        className="bg-cover bg-center flex items-center justify-center p-8"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://images.unsplash.com/photo-1507679799987-c73779587ccf')`
        }}
      >
        <div className="text-white max-w-lg">
          <h1 className="text-4xl font-bold mb-4">
            Transform Your Contact Center Training
          </h1>
          <p className="text-lg opacity-90">
            CloudLMS helps you create personalized learning paths, 
            track agent performance, and ensure compliance with ease.
          </p>
        </div>
      </div>
    </div>
  );
}