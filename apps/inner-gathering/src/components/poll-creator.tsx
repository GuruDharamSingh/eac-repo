/**
 * Poll Creator Component
 * Simple form to create availability polls
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import { format, addMinutes } from 'date-fns';

interface TimeSlot {
  id: string;
  date: Date;
}

export function PollCreator() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [allowMaybe, setAllowMaybe] = useState(true);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [submitting, setSubmitting] = useState(false);

  const handleAddTimeSlot = () => {
    if (selectedDates.length === 0) {
      alert('Please select at least one date first');
      return;
    }

    const [hours, minutes] = newSlotTime.split(':').map(Number);

    // Add time slot for each selected date
    const newSlots: TimeSlot[] = selectedDates.map((date) => {
      const slotDate = new Date(date);
      slotDate.setHours(hours, minutes, 0, 0);
      return {
        id: `${slotDate.getTime()}`,
        date: slotDate,
      };
    });

    setTimeSlots([...timeSlots, ...newSlots]);
  };

  const handleRemoveSlot = (id: string) => {
    setTimeSlots(timeSlots.filter((slot) => slot.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a poll title');
      return;
    }

    if (timeSlots.length === 0) {
      alert('Please add at least one time slot');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          timeSlots: timeSlots.map((slot) => slot.date.toISOString()),
          allowMaybe,
          slotDuration: 30, // Default 30 minutes
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create poll');
      }

      const data = await response.json();
      router.push(`/polls/${data.poll.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create poll');
      setSubmitting(false);
    }
  };

  // Sort time slots chronologically
  const sortedSlots = [...timeSlots].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950">
          <CardTitle className="text-xl">📝 Poll Details</CardTitle>
          <CardDescription>Give your poll a name and description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Team Meeting"
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add any additional details about this meeting..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Date Selection */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
          <CardTitle className="text-xl">📅 Select Dates</CardTitle>
          <CardDescription>
            Choose the dates you want to include (click multiple dates)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates || [])}
            className="rounded-md border"
          />
          {selectedDates.length > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              {selectedDates.length} {selectedDates.length === 1 ? 'date' : 'dates'} selected
            </p>
          )}
        </CardContent>
      </Card>

      {/* Time Slot Builder */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
          <CardTitle className="text-xl">⏰ Add Time Slots</CardTitle>
          <CardDescription>
            Add times for each selected date (e.g., 9:00 AM)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="time"
              value={newSlotTime}
              onChange={(e) => setNewSlotTime(e.target.value)}
              disabled={selectedDates.length === 0}
            />
            <Button
              type="button"
              onClick={handleAddTimeSlot}
              disabled={selectedDates.length === 0}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Time
            </Button>
          </div>

          {sortedSlots.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <p className="text-sm font-medium">
                {sortedSlots.length} time {sortedSlots.length === 1 ? 'slot' : 'slots'}:
              </p>
              {sortedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex items-center justify-between p-2 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(slot.date, 'EEE, MMM d, yyyy • h:mm a')}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSlot(slot.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settings */}
      <Card className="border-2">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardTitle className="text-xl">⚙️ Poll Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allowMaybe"
              checked={allowMaybe}
              onCheckedChange={(checked) => setAllowMaybe(checked === true)}
            />
            <Label htmlFor="allowMaybe" className="cursor-pointer">
              Allow "Maybe" responses
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Card className="border-2 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Button
              type="submit"
              size="lg"
              disabled={submitting || !title.trim() || timeSlots.length === 0}
              className="flex-1 text-base font-semibold"
            >
              {submitting ? 'Creating Poll...' : `Create Poll (${timeSlots.length} slots)`}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
          {timeSlots.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Add at least one time slot to create the poll
            </p>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
