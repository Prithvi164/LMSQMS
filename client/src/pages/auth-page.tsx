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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { loginMutation, registerMutation } = useAuth();

  const handleAuth = async (
    username: string, 
    password: string, 
    isRegister: boolean
  ) => {
    try {
      if (isRegister) {
        await registerMutation.mutateAsync({ username, password });
      } else {
        await loginMutation.mutateAsync({ username, password });
      }
      navigate("/");
    } catch (error: any) {
      toast({
        title: isRegister ? "Registration failed" : "Login failed",
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
              Your contact center training platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleAuth(
                    formData.get("username") as string,
                    formData.get("password") as string,
                    false
                  );
                }}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        name="username" 
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
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={loginMutation.isPending}
                    >
                      Login
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  handleAuth(
                    formData.get("username") as string,
                    formData.get("password") as string,
                    true
                  );
                }}>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="reg-username">Username</Label>
                      <Input 
                        id="reg-username" 
                        name="username" 
                        required 
                      />
                    </div>
                    <div>
                      <Label htmlFor="reg-password">Password</Label>
                      <Input 
                        id="reg-password" 
                        name="password" 
                        type="password" 
                        required 
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full"
                      disabled={registerMutation.isPending}
                    >
                      Register
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
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