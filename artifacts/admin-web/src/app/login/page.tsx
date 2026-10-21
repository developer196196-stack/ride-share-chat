'use client';

import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const { login, loading, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void login(email, password);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/10">
            <ShieldCheck className="h-6 w-6 stroke-[2]" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Rideshare Chats</h2>
            <p className="text-xs text-muted-foreground">Admin console — riders, reports, live rooms and Trip Validation</p>
          </div>
        </div>

        <Card className="border-border bg-card shadow-xl rounded-xl">
          <CardHeader className="space-y-1.5 pb-4">
            <CardTitle className="text-lg font-semibold text-foreground">Sign in</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">Use your administrator email and password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {authError && (
              <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-600 dark:text-red-400 leading-normal">
                {authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="admin@ridesharechats.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full mt-2 cursor-pointer">
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
