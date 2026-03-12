import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Keyboard, X } from 'lucide-react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'K'], description: 'Open command palette', category: 'Navigation' },
  { keys: ['/'], description: 'Focus search', category: 'Navigation' },
  { keys: ['Esc'], description: 'Clear focus / Close dialog', category: 'General' },
  { keys: ['Ctrl', 'R'], description: 'Refresh data', category: 'Actions' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Help' },
];

const categories = Array.from(new Set(shortcuts.map(s => s.category)));

export function KeyboardShortcutHelper({ inline = false }: { inline?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  useKeyboardShortcuts([
    {
      key: '?',
      shift: true,
      callback: () => setIsOpen(true),
      description: 'Show keyboard shortcuts'
    }
  ]);

  return (
    <>
      {!inline && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          className="hidden md:flex fixed bottom-4 right-4 z-40 rounded-full shadow-lg bg-background border border-border"
          aria-label="Show keyboard shortcuts"
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Speed up your workflow with these keyboard shortcuts
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {categories.map(category => (
              <div key={category}>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter(s => s.category === category)
                    .map((shortcut, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <div className="flex items-center gap-1">
                          {shortcut.keys.map((key, keyIdx) => (
                            <kbd
                              key={keyIdx}
                              className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded shadow-sm"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">Shift</kbd> +{' '}
              <kbd className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">?</kbd> to show this dialog
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Export a trigger button for inline use
export function KeyboardShortcutButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-9 px-2 flex-shrink-0 hidden md:flex"
      onClick={onClick}
      title="Keyboard shortcuts"
    >
      <Keyboard className="h-4 w-4" />
    </Button>
  );
}
