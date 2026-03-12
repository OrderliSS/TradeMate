interface ScreenReaderAnnouncerProps {
  message: string;
  politeness?: 'polite' | 'assertive';
}

export const ScreenReaderAnnouncer = ({ 
  message, 
  politeness = 'polite' 
}: ScreenReaderAnnouncerProps) => {
  if (!message) return null;
  
  return (
    <div 
      role="status" 
      aria-live={politeness} 
      aria-atomic="true" 
      className="sr-only"
    >
      {message}
    </div>
  );
};
