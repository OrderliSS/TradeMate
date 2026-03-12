import { useState } from "react";

interface TimelineNote {
  id: string;
  note_content: string;
  created_at: string;
  note_type?: string;
}

interface UseTimelineViewerProps {
  notes: TimelineNote[];
  entityTitle: string;
  onAddNote?: (content: string) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  canAddNotes?: boolean;
  canDeleteNotes?: boolean;
}

export const useTimelineViewer = ({
  notes,
  entityTitle,
  onAddNote,
  onDeleteNote,
  canAddNotes = true,
  canDeleteNotes = true,
}: UseTimelineViewerProps) => {
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  const openTimeline = () => setIsTimelineOpen(true);
  const closeTimeline = () => setIsTimelineOpen(false);

  const handleAddNote = async (content: string) => {
    if (onAddNote) {
      await onAddNote(content);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (onDeleteNote) {
      await onDeleteNote(noteId);
    }
  };

  return {
    isTimelineOpen,
    openTimeline,
    closeTimeline,
    handleAddNote,
    handleDeleteNote,
    timelineProps: {
      isOpen: isTimelineOpen,
      onClose: closeTimeline,
      title: `${entityTitle} - Complete Timeline`,
      notes,
      onAddNote: canAddNotes ? handleAddNote : undefined,
      onDeleteNote: canDeleteNotes ? handleDeleteNote : undefined,
      canAddNotes,
      canDeleteNotes,
    },
  };
};