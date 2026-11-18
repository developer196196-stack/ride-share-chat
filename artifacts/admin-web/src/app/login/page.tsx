'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { publicAsset } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const SECTIONS = ['Overview', 'Rider Management', 'Trip Validation', 'Room Categories', 'Live R.O.O.M.s', 'Safety Alerts', 'Reports'];

export default function LoginPage() {
  const { login, loading, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void login(email, password);
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Brand panel: the console's navy sidebar colour. Hidden on small screens. */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-sidebar-primary/20 blur-3xl"
        />
        <div className="relative flex items-center gap-3">
          <Image
            src={publicAsset('/logo-mark.png')}
            alt="RideShare Chats logo"
            width={48}
            height={48}
            priority
            className="h-12 w-12 rounded-md bg-white object-contain p-0.5"
          />
          <div className="leading-none">
            <div className="font-display text-[17px] font-bold">RideShare Chats</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">Ops Console</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-[40px] font-bold leading-[1.05]">Run the ride from one console.</h2>
          <p className="mt-4 text-sm text-white/60">Riders, reports, live rooms and Trip Validation in one place.</p>
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2.5">
            {SECTIONS.map((label, i) => (
              <li key={label} className="flex items-center gap-2.5 text-[13px] text-white/70">
                <span className="font-mono text-[10px] text-sidebar-primary">{String(i + 1).padStart(2, '0')}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative font-mono text-[10px] uppercase tracking-[0.14em] text-white/30">Administrators only</div>
      </aside>

      {/* Sign-in */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">
          <Image
            src={publicAsset('/logo-mark.png')}
            alt="RideShare Chats logo"
            width={56}
            height={56}
            priority
            className="mb-8 h-14 w-14 rounded-lg object-contain lg:hidden"
          />
          <div className="eyebrow">Ops Console</div>
          <h1 className="font-display mt-1.5 text-[32px] font-bold leading-none text-foreground">Sign in</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">Use your administrator email and password.</p>

          {authError ? (
            <div role="alert" className="mt-6 rounded-md border border-primary/25 bg-accent p-3 text-xs leading-normal text-accent-foreground">
              {authError}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-[12px] font-semibold text-foreground/80">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="username"
                placeholder="admin@ridesharechats.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-[12px] font-semibold text-foreground/80">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10"
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2 h-10 w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
