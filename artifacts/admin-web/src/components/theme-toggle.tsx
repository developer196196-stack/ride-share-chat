'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/providers/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 px-0 border border-border hover:bg-accent text-foreground"
          data-testid="button-theme-toggle"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="cursor-pointer py-1.5 text-xs"
          data-testid="button-theme-light"
        >
          <Sun className="mr-2 h-3.5 w-3.5" />
          <span>Light</span>
          {theme === 'light' && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="cursor-pointer py-1.5 text-xs"
          data-testid="button-theme-dark"
        >
          <Moon className="mr-2 h-3.5 w-3.5" />
          <span>Dark</span>
          {theme === 'dark' && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-foreground" />
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
