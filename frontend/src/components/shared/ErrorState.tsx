import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  icon = <AlertTriangle className="h-10 w-10 text-red-500" />
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-red-50/50 border border-red-100 rounded-lg max-w-2xl mx-auto my-8">
      <div className="mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md mb-6">{message}</p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="bg-white hover:bg-slate-50 shadow-sm gap-2">
          <RefreshCcw className="w-4 h-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}
