
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function HealthCheck() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [dbStatus, setDbStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [authStatus, setAuthStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    checkApiHealth();
  }, []);

  const checkApiHealth = async () => {
    // Reset states
    setApiStatus('loading');
    setDbStatus('loading');
    setAuthStatus('loading');
    setErrorMessage(null);
    
    try {
      // Check API health
      const healthResponse = await fetch('/health');
      const healthData = await healthResponse.json();
      
      if (healthData.status === 'ok') {
        setApiStatus('success');
        
        // If API is healthy, check auth system
        try {
          const userResponse = await fetch('/api/user');
          if (userResponse.status === 401) {
            // 401 is expected when not logged in, auth is working
            setAuthStatus('success');
          } else if (userResponse.status === 200) {
            // User is logged in, auth is working
            setAuthStatus('success');
          } else {
            setAuthStatus('error');
            setErrorMessage(`Auth check returned unexpected status: ${userResponse.status}`);
          }
        } catch (authError) {
          setAuthStatus('error');
          setErrorMessage(`Auth check failed: ${authError}`);
        }
        
        // Check basic database connectivity via organization endpoint
        try {
          const orgResponse = await fetch('/api/organizations/35/settings');
          if (orgResponse.ok) {
            setDbStatus('success');
          } else {
            setDbStatus('error');
            const errorData = await orgResponse.json();
            setErrorMessage(`Database check failed: ${errorData.message || 'Unknown error'}`);
          }
        } catch (dbError) {
          setDbStatus('error');
          setErrorMessage(`Database check failed: ${dbError}`);
        }
      } else {
        setApiStatus('error');
        setErrorMessage(`API health check failed: ${healthData.message || 'Unknown error'}`);
      }
    } catch (error) {
      setApiStatus('error');
      setErrorMessage(`API health check failed: ${error}`);
    }
  };

  const StatusIcon = ({ status }: { status: 'loading' | 'success' | 'error' }) => {
    if (status === 'loading') return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
    if (status === 'success') return <CheckCircle className="h-6 w-6 text-green-500" />;
    return <XCircle className="h-6 w-6 text-red-500" />;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Application Health Check</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <StatusIcon status={apiStatus} />
              <span className="ml-2">API Server</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {apiStatus === 'loading' && 'Checking API server...'}
              {apiStatus === 'success' && 'API server is running properly.'}
              {apiStatus === 'error' && 'API server check failed.'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <StatusIcon status={dbStatus} />
              <span className="ml-2">Database</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {dbStatus === 'loading' && 'Checking database connection...'}
              {dbStatus === 'success' && 'Database is connected and working.'}
              {dbStatus === 'error' && 'Database connection check failed.'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <StatusIcon status={authStatus} />
              <span className="ml-2">Authentication</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {authStatus === 'loading' && 'Checking authentication system...'}
              {authStatus === 'success' && 'Authentication system is working.'}
              {authStatus === 'error' && 'Authentication system check failed.'}
            </p>
          </CardContent>
        </Card>
      </div>
      
      {errorMessage && (
        <Card className="mb-6 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-red-700">Error Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 whitespace-pre-wrap">{errorMessage}</p>
          </CardContent>
        </Card>
      )}
      
      <Button onClick={checkApiHealth} className="mr-2">
        Refresh Health Status
      </Button>
    </div>
  );
}
