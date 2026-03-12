import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PauseCircle, CalendarIcon, X, Bell, Link as LinkIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PENDING_REASON_OPTIONS } from "@/components/DeliveryFulfillmentDialog";
import { useLinkedReminder } from "@/hooks/useLinkedReminder";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";

interface QuickPendPopoverProps {
  purchaseId: string;
  customerName?: string | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function QuickPendPopover({
  purchaseId,
  customerName,
  trigger,
  onSuccess,
}: QuickPendPopoverProps) {
  const [open, setOpen] = useState(false);
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [pendingUntilDate, setPendingUntilDate] = useState<Date | undefined>();
  const [pendingUntilTime, setPendingUntilTime] = useState<string>("09:00");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [createReminder, setCreateReminder] = useState(false);
  const [reminderAction, setReminderAction] = useState<'update' | 'create-new' | 'none'>('update');
  const [reminderActionReason, setReminderActionReason] = useState("");
  
  const queryClient = useQueryClient();
  
  // Check if there's an existing linked reminder
  const { data: linkedReminder, isLoading: isLoadingReminder } = useLinkedReminder(purchaseId);
  const hasLinkedReminder = !!linkedReminder;

  const pendingReason = selectedReasonOption === "other" 
    ? customReason 
    : PENDING_REASON_OPTIONS.find(opt => opt.value === selectedReasonOption)?.label || "";

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Combine pending date and time
      let pendingUntilDateTime: Date | undefined;
      if (pendingUntilDate) {
        const [hours, minutes] = pendingUntilTime.split(':').map(Number);
        pendingUntilDateTime = new Date(pendingUntilDate);
        pendingUntilDateTime.setHours(hours, minutes, 0, 0);
      }
      
      const updates: Record<string, any> = {
        delivery_status: "pending",
        fulfillment_pending_until: pendingUntilDateTime?.toISOString() || null,
        fulfillment_pending_reason: pendingReason || null,
        // Clear completed fields
        collection_method: null,
        delivery_completed_at: null,
      };

      const { error } = await supabase
        .from("purchases")
        .update(updates)
        .eq("id", purchaseId);

      if (error) throw error;

      // Get the current user
      const { data: userData } = await supabase.auth.getUser();

      // Add pending reason to case notes if reason is provided
      if (pendingReason) {
        const { data: purchaseData } = await supabase
          .from("purchases")
          .select("case_id")
          .eq("id", purchaseId)
          .single();

        if (purchaseData?.case_id) {
          const noteContent = additionalNotes.trim()
            ? `Fulfillment set to pending: ${pendingReason}\n\nNotes: ${additionalNotes.trim()}`
            : `Fulfillment set to pending: ${pendingReason}`;
          
          await supabase.from("task_notes").insert({
            task_id: purchaseData.case_id,
            note_content: noteContent,
            note_type: "system",
            created_by: userData.user?.id,
          });
        }
      }

      // Handle reminder based on user's chosen action
      if (pendingUntilDateTime) {
        if (hasLinkedReminder && linkedReminder) {
          if (reminderAction === 'update') {
            // Update existing reminder's due date
            const { error: reminderError } = await supabase
              .from("tasks")
              .update({ 
                due_date: pendingUntilDateTime.toISOString(),
                ...(pendingReason ? {
                  description: `Pending reason: ${pendingReason}\n\nRescheduled on ${format(new Date(), "PPP")} until ${format(pendingUntilDateTime, "PPP 'at' h:mm a")}.`
                } : {})
              })
              .eq("id", linkedReminder.id);
            
            if (reminderError) {
              console.error("Error updating linked reminder:", reminderError);
            }
          } else if (reminderAction === 'create-new') {
            // Create new reminder instead
            const { data: profile } = await supabase
              .from("profiles")
              .select("default_organization_id")
              .eq("id", userData.user?.id)
              .single();

            const taskTitle = `Reminder: Fulfillment pending${customerName ? ` - ${customerName}` : ""}`;
            let taskDescription = pendingReason
              ? `Pending reason: ${pendingReason}\n\nThis reminder was created on ${format(new Date(), "PPP")} for ${format(pendingUntilDateTime, "PPP 'at' h:mm a")}.`
              : `Fulfillment was set to pending until ${format(pendingUntilDateTime, "PPP 'at' h:mm a")}. Follow up with customer.`;
            
            if (reminderActionReason.trim()) {
              taskDescription += `\n\nReason for new reminder: ${reminderActionReason.trim()}`;
            }

            await supabase.from("tasks").insert({
              title: taskTitle,
              description: taskDescription,
              due_date: pendingUntilDateTime.toISOString(),
              status: "pending",
              priority: "medium",
              task_type: "reminder",
              purchase_id: purchaseId,
              organization_id: profile?.default_organization_id,
            });
          }
          // 'none' = do nothing
        } else if (createReminder) {
          // No linked reminder, create new if requested
          const { data: profile } = await supabase
            .from("profiles")
            .select("default_organization_id")
            .eq("id", userData.user?.id)
            .single();

          const taskTitle = `Reminder: Fulfillment pending${customerName ? ` - ${customerName}` : ""}`;
          const taskDescription = pendingReason
            ? `Pending reason: ${pendingReason}\n\nThis reminder was auto-created when fulfillment was set to pending until ${format(pendingUntilDateTime, "PPP 'at' h:mm a")}.`
            : `Fulfillment was set to pending until ${format(pendingUntilDateTime, "PPP 'at' h:mm a")}. Follow up with customer.`;

          await supabase.from("tasks").insert({
            title: taskTitle,
            description: taskDescription,
            due_date: pendingUntilDateTime.toISOString(),
            status: "pending",
            priority: "medium",
            task_type: "reminder",
            purchase_id: purchaseId,
            organization_id: profile?.default_organization_id,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["task-notes"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      queryClient.invalidateQueries({ queryKey: ["linked-reminder", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-linked-records", purchaseId] });
      
      let message = "Marked as pending";
      if (hasLinkedReminder && pendingUntilDate) {
        if (reminderAction === 'update') {
          message = "Marked as pending – reminder updated";
        } else if (reminderAction === 'create-new') {
          message = "Marked as pending – new reminder created";
        }
      } else if (createReminder && pendingUntilDate) {
        message = "Marked as pending with reminder";
      }
      toast.success(message);
      
      handleClose();
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Error setting pending:", error);
      toast.error("Failed to set pending status");
    },
  });

  const handleClose = () => {
    setOpen(false);
    // Reset form
    setSelectedReasonOption("");
    setCustomReason("");
    setAdditionalNotes("");
    setPendingUntilDate(undefined);
    setPendingUntilTime("09:00");
    setShowDatePicker(false);
    setCreateReminder(false);
    setReminderAction('update');
    setReminderActionReason("");
  };

  const handleSave = () => {
    updateMutation.mutate();
  };

  const canSave = !!selectedReasonOption && (selectedReasonOption !== "other" || customReason.trim());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950/30"
          >
            <PauseCircle className="h-3.5 w-3.5" />
            Pend
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-4" 
        align="end" 
        side="bottom"
        sideOffset={4}
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Set Pending</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Reason Select */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Reason</Label>
            <Select
              value={selectedReasonOption}
              onValueChange={setSelectedReasonOption}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {PENDING_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Reason Textarea */}
          {selectedReasonOption === "other" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Custom reason</Label>
              <Textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter custom reason..."
                className="min-h-[60px] text-sm resize-none"
              />
            </div>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Additional notes (optional)</Label>
            <Textarea
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="Add any additional notes..."
              className="min-h-[60px] text-sm resize-none"
            />
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Until (optional)</Label>
            <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9",
                    !pendingUntilDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {pendingUntilDate ? format(pendingUntilDate, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={pendingUntilDate}
                  onSelect={(date) => {
                    setPendingUntilDate(date);
                    setShowDatePicker(false);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
                {/* Time picker */}
                <div className="px-3 pb-3 border-t pt-3 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Follow-up Time
                  </Label>
                  <Input
                    type="time"
                    value={pendingUntilTime}
                    onChange={(e) => setPendingUntilTime(e.target.value)}
                    className="h-9 w-full text-sm"
                  />
                </div>
              </PopoverContent>
            </Popover>
            {pendingUntilDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground px-0"
                onClick={() => setPendingUntilDate(undefined)}
              >
                Clear date
              </Button>
            )}
          </div>

          {/* Linked Reminder or Create Reminder Checkbox */}
          {pendingUntilDate && (
            <>
              {hasLinkedReminder && linkedReminder ? (
                <div className="space-y-3 p-3 rounded-md bg-muted/30 border">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm">
                      Linked: <span className="font-medium">{linkedReminder.task_number}</span>
                    </span>
                  </div>
                  
                  <RadioGroup 
                    value={reminderAction} 
                    onValueChange={(val) => setReminderAction(val as 'update' | 'create-new' | 'none')}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="update" id="qp-rem-update" />
                      <Label htmlFor="qp-rem-update" className="text-sm font-normal cursor-pointer">
                        Update existing reminder
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="create-new" id="qp-rem-create" />
                      <Label htmlFor="qp-rem-create" className="text-sm font-normal cursor-pointer">
                        Create new reminder instead
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="qp-rem-none" />
                      <Label htmlFor="qp-rem-none" className="text-sm font-normal cursor-pointer">
                        No reminder action
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {reminderAction !== 'update' && (
                    <div className="space-y-1.5 pt-2 border-t">
                      <Label className="text-xs text-muted-foreground">
                        Reason (optional)
                      </Label>
                      <Input 
                        placeholder="Why not updating existing reminder?"
                        value={reminderActionReason}
                        onChange={(e) => setReminderActionReason(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="create-reminder"
                    checked={createReminder}
                    onCheckedChange={(checked) => setCreateReminder(checked === true)}
                  />
                  <Label
                    htmlFor="create-reminder"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Create reminder task
                  </Label>
                </div>
              )}
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!canSave || updateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
