import { useState } from 'react';

export interface TaskAction {
  id: string;
  type: 'update' | 'delete' | 'bulk_update' | 'bulk_delete';
  timestamp: number;
  description: string;
  previousState: any;
  newState: any;
  taskIds: string[];
}

export const useActionHistory = (maxHistorySize = 50) => {
  const [history, setHistory] = useState<TaskAction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const addAction = (action: Omit<TaskAction, 'id' | 'timestamp'>) => {
    const newAction: TaskAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
    
    // Remove any future actions if we've undone and then perform new action
    const newHistory = [...history.slice(0, currentIndex + 1), newAction];
    
    // Limit history size
    const trimmedHistory = newHistory.slice(-maxHistorySize);
    
    setHistory(trimmedHistory);
    setCurrentIndex(trimmedHistory.length - 1);
  };
  
  const undo = (): TaskAction | null => {
    if (!canUndo) return null;
    
    const action = history[currentIndex];
    setCurrentIndex(currentIndex - 1);
    return action;
  };
  
  const redo = (): TaskAction | null => {
    if (!canRedo) return null;
    
    const action = history[currentIndex + 1];
    setCurrentIndex(currentIndex + 1);
    return action;
  };
  
  const clear = () => {
    setHistory([]);
    setCurrentIndex(-1);
  };
  
  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;
  
  return { 
    addAction, 
    undo, 
    redo, 
    clear,
    canUndo, 
    canRedo, 
    history,
    currentAction: history[currentIndex]
  };
};
