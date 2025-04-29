import React, { useState } from 'react';
import { CameraIcon, PhotographIcon, XIcon } from '@heroicons/react/outline';
import CameraCapture from './CameraCapture';
import { ResponsiveCard } from './ui/ResponsiveComponents';

interface TaskSubmissionWithProofProps {
  taskId: string;
  onSubmit: (data: { taskId: string; proofPhoto: string; notes: string }) => Promise<void>;
  onCancel: () => void;
}

export default function TaskSubmissionWithProof({
  taskId,
  onSubmit,
  onCancel
}: TaskSubmissionWithProofProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [proofPhoto, setProofPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = (imageData: string) => {
    setProofPhoto(imageData);
    setShowCamera(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!proofPhoto) {
      setError('Please take a photo as proof of completion');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      await onSubmit({
        taskId,
        proofPhoto,
        notes
      });
    } catch (err) {
      setError('Failed to submit task. Please try again.');
      console.error('Task submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showCamera) {
    return <CameraCapture onCapture={handleCapture} onClose={() => setShowCamera(false)} />;
  }

  return (
    <ResponsiveCard className="max-w-lg mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Submit Task Completion</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-500 touch-manipulation"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Photo Proof Section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Photo Proof
          </label>
          
          {proofPhoto ? (
            <div className="relative">
              <img
                src={proofPhoto}
                alt="Task completion proof"
                className="w-full h-48 object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => setProofPhoto(null)}
                className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 touch-manipulation"
                aria-label="Remove photo"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-600 hover:border-indigo-500 hover:text-indigo-500 touch-manipulation"
            >
              <CameraIcon className="h-8 w-8" />
              <span className="text-sm font-medium">Take Photo</span>
            </button>
          )}
        </div>

        {/* Notes Section */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Additional Notes
          </label>
          <textarea
            id="notes"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Add any additional notes about the task completion..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Task'}
          </button>
        </div>
      </form>
    </ResponsiveCard>
  );
} 