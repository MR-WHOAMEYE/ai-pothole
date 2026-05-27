import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/src/components/ui/sheet';
import { Button } from '@/src/components/ui/button';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useAssignCrewMutation } from '@/src/hooks/useReports';
import { DamageReport } from '@/src/lib/mockData';
import { Calendar } from '@/src/components/ui/calendar';
import { CalendarIcon, Check, Mail, UserCheck } from 'lucide-react';
import { format } from 'date-fns';

interface AssignWorkerSheetProps {
  report: DamageReport | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignWorkerSheet({ report, isOpen, onOpenChange }: AssignWorkerSheetProps) {
  const [teamName, setTeamName] = useState<string>('');
  const [wardEmail, setWardEmail] = useState<string>('');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const assignMutation = useAssignCrewMutation();

  useEffect(() => {
    if (!isOpen) {
      setTeamName('');
      setWardEmail('');
      setScheduledDate('');
      setSelectedDate(undefined);
      setShowCalendar(false);
    }
  }, [isOpen]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !teamName) return;

    assignMutation.mutate(
      {
        reportId: report.id,
        teamName,
        wardEmail: wardEmail || undefined,
        scheduledDate: scheduledDate || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const crewTeams = [
    { value: 'Team Alpha', label: 'Team Alpha (Zone 1 - East)' },
    { value: 'Team Beta', label: 'Team Beta (Zone 2 - Central)' },
    { value: 'Team Gamma', label: 'Team Gamma (Zone 3 - West)' },
    { value: 'Rapid Repair Crew 4', label: 'Rapid Repair Crew 4 (Citywide)' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-100 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-zinc-100 flex items-center gap-2">
            <UserCheck className="size-5" />
            Assign Repair Assignment
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Dispatch a maintenance crew and log a formal municipal notification for the pothole at{' '}
            <strong className="text-zinc-200">{report?.streetAddress || 'selected location'}</strong>.
          </SheetDescription>
        </SheetHeader>

        {report && (
          <form onSubmit={handleAssign} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label className="text-zinc-300">Target Pothole Details</Label>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">ID:</span>
                  <span className="font-mono text-zinc-300 select-all">{report.id.substring(0, 8)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Severity:</span>
                  <span className={`font-semibold ${
                    report.severity === 'CRITICAL' ? 'text-red-500' : 'text-yellow-500'
                  }`}>{report.severity}</span>
                </div>
                {report.estimatedDepthCm && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Est. Depth:</span>
                    <span className="text-zinc-300">{report.estimatedDepthCm != null ? report.estimatedDepthCm.toFixed(1) : 'N/A'} cm</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamName" className="text-zinc-300">Select Dispatch Crew *</Label>
              <Select value={teamName} onValueChange={setTeamName} required>
                <SelectTrigger id="teamName" className="bg-zinc-900 border-zinc-800 focus:ring-zinc-700">
                  <SelectValue placeholder="Choose a repair team" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  {crewTeams.map((team) => (
                    <SelectItem key={team.value} value={team.value} className="focus:bg-zinc-800 focus:text-zinc-100">
                      {team.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <Label className="text-zinc-300">Schedule Date (Optional)</Label>
              <div className="relative">
                <Button
                  id="scheduledDate"
                  type="button"
                  variant="outline"
                  onClick={() => setShowCalendar(!showCalendar)}
                  className="w-full bg-zinc-900 border-zinc-800 text-left justify-start text-xs font-normal text-zinc-300 flex items-center gap-2 h-9 px-3 hover:bg-zinc-850 hover:text-zinc-100"
                >
                  <CalendarIcon className="size-4 text-zinc-500" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a schedule date</span>}
                </Button>
                
                {showCalendar && (
                  <div className="absolute z-50 mt-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 shadow-xl left-0 right-0 flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date);
                        if (date) {
                          setScheduledDate(format(date, 'yyyy-MM-dd'));
                        } else {
                          setScheduledDate('');
                        }
                        setShowCalendar(false);
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-500">
                Select a planned repair date for this dispatch.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wardEmail" className="text-zinc-300">Ward Office Notification Email (Optional)</Label>
              <div className="relative">
                <Input
                  id="wardEmail"
                  type="email"
                  placeholder="ward.officer@municipality.gov"
                  value={wardEmail}
                  onChange={(e) => setWardEmail(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 pl-9 focus-visible:ring-zinc-700"
                />
                <Mail className="absolute left-3 top-3 size-4 text-zinc-500" />
              </div>
              <p className="text-[10px] text-zinc-500">
                If provided, a formal complaint notification will be dispatched immediately.
              </p>
            </div>

            <SheetFooter className="pt-4 border-t border-zinc-900">
              <Button
                type="submit"
                disabled={!teamName || assignMutation.isPending}
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium flex items-center justify-center gap-2"
              >
                {assignMutation.isPending ? 'Assigning...' : (
                  <>
                    <Check className="size-4" /> Confirm Assignment
                  </>
                )}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
