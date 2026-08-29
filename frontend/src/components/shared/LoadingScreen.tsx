import { Loader2 } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ message = 'Loading...', fullScreen = false }: LoadingScreenProps) {
  const containerClass = fullScreen 
    ? 'flex min-h-screen items-center justify-center bg-slate-50' 
    : 'flex flex-col items-center justify-center p-12 min-h-[400px] w-full';

  return (
    <div className={containerClass}>
      <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
      <p className="text-slate-600 font-medium">{message}</p>
    </div>
  );
}
