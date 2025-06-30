import React, { useState, useEffect } from 'react';
import { differenceInDays, differenceInHours, differenceInMinutes, isPast } from 'date-fns';

interface TaskCountdownProps {
  dueDate: string;
  status: string;
}

export default function TaskCountdown({ dueDate, status }: TaskCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const due = new Date(dueDate);

      if (isPast(due)) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0 });
        return;
      }

      const days = differenceInDays(due, now);
      const hours = differenceInHours(due, now) % 24;
      const minutes = differenceInMinutes(due, now) % 60;

      setTimeLeft({ days, hours, minutes });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [dueDate]);

  if (!timeLeft || status === 'Completed') return null;

  const getColorClass = () => {
    if (timeLeft.days === 0 && timeLeft.hours < 12) {
      return 'text-red-600';
    }
    if (timeLeft.days === 0) {
      return 'text-orange-500';
    }
    if (timeLeft.days <= 2) {
      return 'text-yellow-500';
    }
    return 'text-green-600';
  };

  return (
    <div className={`flex items-center space-x-1 ${getColorClass()}`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
          clipRule="evenodd"
        />
      </svg>
      <span className="text-sm font-medium">
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {timeLeft.hours > 0 && `${timeLeft.hours}h `}
        {timeLeft.minutes}m
      </span>
    </div>
  );
} 