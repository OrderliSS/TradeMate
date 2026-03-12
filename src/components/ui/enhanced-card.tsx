import React from 'react';
import { cn } from '@/lib/utils';

export const EnhancedCard = ({ children, className }: any) => <div className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}>{children}</div>;
export const EnhancedCardHeader = ({ children, className }: any) => <div className={cn("flex flex-col space-y-1.5 p-6", className)}>{children}</div>;
export const EnhancedCardTitle = ({ children, className }: any) => <h3 className={cn("font-semibold leading-none tracking-tight", className)}>{children}</h3>;
export const EnhancedCardContent = ({ children, className }: any) => <div className={cn("p-6 pt-0", className)}>{children}</div>;