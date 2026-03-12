import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { toast } from 'sonner';

interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'task';
  data: any;
  timestamp: number;
  retries: number;
}

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useLocalStorage<QueuedAction[]>('offline_sync_queue', []);
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will sync when connection is restored.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const queueAction = (action: Omit<QueuedAction, 'id' | 'timestamp' | 'retries'>) => {
    const queuedAction: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0
    };
    
    setSyncQueue(queue => [...queue, queuedAction]);
  };
  
  const clearQueue = () => {
    setSyncQueue([]);
  };
  
  return {
    isOnline,
    syncQueue,
    queueAction,
    clearQueue,
    isSyncing,
    pendingCount: syncQueue.length
  };
};
