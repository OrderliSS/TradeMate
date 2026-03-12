import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme, effectiveTheme } = useTheme();
  
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const osTheme = systemPrefersDark ? 'dark' : 'light';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem onClick={() => setTheme('light')} className={theme === 'light' ? 'bg-accent' : ''}>
              <Sun className="mr-2 h-4 w-4" />
              <span>Light</span>
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Always use light theme</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem onClick={() => setTheme('dark')} className={theme === 'dark' ? 'bg-accent' : ''}>
              <Moon className="mr-2 h-4 w-4" />
              <span>Dark</span>
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Always use dark theme</p>
          </TooltipContent>
        </Tooltip>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuItem onClick={() => setTheme('system')} className={theme === 'system' ? 'bg-accent' : ''}>
              <Monitor className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>System</span>
                <span className="text-xs text-muted-foreground">
                  OS: {osTheme}{theme === 'system' && ` • Currently: ${effectiveTheme}`}
                </span>
              </div>
            </DropdownMenuItem>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Follow your device settings</p>
          </TooltipContent>
        </Tooltip>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}