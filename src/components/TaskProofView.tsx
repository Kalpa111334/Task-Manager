import React, { useState } from 'react';
import { Dialog } from '@headlessui/react';
import { XIcon, CheckIcon, XCircleIcon } from '@heroicons/react/outline';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

interface TaskProof {
  id: number;
  task_id: string;
  image_url: string;
  description: string;
  submitted_by: string;
  created_at: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejection_reason?: string;
}

interface TaskProofViewProps {
  isOpen: boolean;
  onClose: () => void;
  proof: TaskProof;
  isAdmin?: boolean;
  onStatusUpdate?: () => void;
}

export default function TaskProofView({
  isOpen,
  onClose,
  proof,
  isAdmin = false,
  onStatusUpdate,
}: TaskProofViewProps) {
  const { user } = useAuth();
  const [rejectionReason, setRejectionReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleApprove = async () => {
    if (!user) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('task_proofs')
        .update({
          status: 'Approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq('id', proof.id);

      if (error) throw error;

      toast.success('Proof approved successfully');
      onStatusUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error approving proof:', error);
      toast.error('Failed to approve proof');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectionReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('task_proofs')
        .update({
          status: 'Rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: rejectionReason.trim(),
        })
        .eq('id', proof.id);

      if (error) throw error;

      toast.success('Proof rejected');
      onStatusUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error rejecting proof:', error);
      toast.error('Failed to reject proof');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-10 overflow-y-auto"
    >
      <div className="min-h-screen px-4 text-center">
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-30" />

        <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex justify-between items-center">
            <Dialog.Title
              as="h3"
              className="text-lg font-medium leading-6 text-gray-900"
            >
              Task Proof
            </Dialog.Title>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
              title="Close modal"
            >
              <XIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="mt-4">
            <div className="aspect-w-16 aspect-h-9">
              <img
                src={proof.image_url}
                alt="Task proof"
                className="object-contain w-full h-full rounded-lg"
              />
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900">Description</h4>
              <p className="mt-1 text-sm text-gray-500">{proof.description}</p>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900">Status</h4>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  proof.status === 'Approved'
                    ? 'bg-green-100 text-green-800'
                    : proof.status === 'Rejected'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {proof.status}
              </span>
            </div>

            {proof.status === 'Rejected' && proof.rejection_reason && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-900">
                  Rejection Reason
                </h4>
                <p className="mt-1 text-sm text-red-500">
                  {proof.rejection_reason}
                </p>
              </div>
            )}

            {isAdmin && proof.status === 'Pending' && (
              <div className="mt-6">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="rejection-reason"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Rejection Reason (required if rejecting)
                    </label>
                    <textarea
                      id="rejection-reason"
                      rows={3}
                      className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide a reason if you plan to reject this proof..."
                    />
                  </div>

                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={isUpdating}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      <CheckIcon className="h-4 w-4 mr-2" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={isUpdating || !rejectionReason.trim()}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      <XCircleIcon className="h-4 w-4 mr-2" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
} 