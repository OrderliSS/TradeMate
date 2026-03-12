import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ImprovedEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'card' | 'minimal';
  className?: string;
}

export const ImprovedEmptyState: React.FC<ImprovedEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
  className = ''
}) => {
  const content = (
    <>
      <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-lg font-medium mb-2 text-center">{title}</h3>
      <p className="text-muted-foreground text-center mb-4 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mx-auto">
          {actionLabel}
        </Button>
      )}
    </>
  );

  if (variant === 'card') {
    return (
      <Card className={className}>
        <CardHeader>
          <CardContent className="pt-6">
            {content}
          </CardContent>
        </CardHeader>
      </Card>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`text-center py-6 ${className}`}>
        <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-muted-foreground text-sm">{title}</p>
      </div>
    );
  }

  return (
    <div className={`text-center py-12 ${className}`}>
      {content}
    </div>
  );
};