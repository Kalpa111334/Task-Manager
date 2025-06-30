import React, { useState, useRef } from 'react';
import { CameraIcon, XIcon, UploadIcon } from '@heroicons/react/outline';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCapture = (imageData: string) => {
    setProofPhoto(imageData);
    setShowCamera(false);
    setError(null);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, etc.)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setProofPhoto(imageData);
      setError(null);
    };
    reader.onerror = () => {
      setError('Failed to read the image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!proofPhoto) {
      setError('Please provide a photo proof of completion');
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
            <div className="relative rounded-lg overflow-hidden">
              <img
                src={proofPhoto}
                alt="Task completion proof"
                className="w-full h-48 sm:h-64 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center space-x-4">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="p-2 bg-white rounded-full text-gray-900 hover:bg-gray-100 touch-manipulation transform active:scale-95 transition-all"
                  aria-label="Retake photo"
                >
                  <CameraIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setProofPhoto(null)}
                  className="p-2 bg-white rounded-full text-gray-900 hover:bg-gray-100 touch-manipulation transform active:scale-95 transition-all"
                  aria-label="Remove photo"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-600 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors touch-manipulation transform active:scale-98 transition-transform"
              >
                <CameraIcon className="h-8 w-8" />
                <span className="text-sm font-medium">Take Photo</span>
                <span className="text-xs text-gray-500">Front/Back Camera</span>
              </button>

              <div 
                className="h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-600 hover:border-indigo-500 hover:text-indigo-500 hover:bg-indigo-50 transition-colors cursor-pointer touch-manipulation transform active:scale-98 transition-transform"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="h-8 w-8" />
                <span className="text-sm font-medium">Upload Image</span>
                <p className="text-xs text-gray-500">JPG, PNG (max 5MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  aria-label="Upload image"
                />
              </div>
            </div>
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
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <XIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-98 transition-transform"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full sm:flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation transform active:scale-98 transition-transform disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Task'}
          </button>
        </div>
      </form>
    </ResponsiveCard>
  );
} 