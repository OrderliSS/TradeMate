/**
 * Connection Status Hook
 * 
 * React hook for accessing realtime connection status
 * and displaying connection indicators in the UI.
 */

import { useState, useEffect } from 'react';
import { connectionStateManager, ConnectionStatus } from '@/lib/realtime';

interface ConnectionStatusState {
  status: ConnectionStatus;
  isConnected: boolean;
  isPolling: boolean;
  lastSyncTimestamp: number;
  reconnectAttempts: number;
}

export function useConnectionStatus(): ConnectionStatusState {
  const [state, setState] = useState<ConnectionStatusState>(() => {
    const currentState = connectionStateManager.getState();
    return {
      status: currentState.status,
      isConnected: currentState.status === 'connected',
      isPolling: connectionStateManager.isPolling(),
      lastSyncTimestamp: currentState.lastSyncTimestamp,
      reconnectAttempts: currentState.reconnectAttempts,
    };
  });

  useEffect(() => {
    const unsubscribe = connectionStateManager.onStatusChange((status, fullState) => {
      setState({
        status,
        isConnected: status === 'connected',
        isPolling: connectionStateManager.isPolling(),
        lastSyncTimestamp: fullState.lastSyncTimestamp,
        reconnectAttempts: fullState.reconnectAttempts,
      });
    });

    return unsubscribe;
  }, []);

  return state;
}
