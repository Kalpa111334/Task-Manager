import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';
import type { Task } from '../types/index';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import TaskSubmissionWithProof from './TaskSubmissionWithProof';
import { useAuth } from '../contexts/AuthContext';

interface TaskProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onProofSubmitted: () => void;
}

export default function TaskProofModal({
  isOpen,
  onClose,
  task,
  onProofSubmitted
}: TaskProofModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (data: { taskId: string; proofPhoto: string; notes: string }) => {
    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      setIsSubmitting(true);

      // Upload the photo proof to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-proofs')
        .upload(
          `${task.id}/${new Date().getTime()}.jpg`,
          // Convert base64 to blob
          await fetch(data.proofPhoto).then(res => res.blob()),
          {
            contentType: 'image/jpeg',
            cacheControl: '3600',
          }
        );

      if (uploadError) throw uploadError;

      // Get the public URL of the uploaded image
      const { data: publicUrlData } = supabase.storage
        .from('task-proofs')
        .getPublicUrl(uploadData.path);

      const now = new Date().toISOString();

      // Create task proof entry
      const { error: proofError } = await supabase
        .from('task_proofs')
        .insert({
          task_id: task.id,
          image_url: publicUrlData.publicUrl,
          description: data.notes,
          submitted_by: user.id,
          created_at: now,
          status: 'Pending'
        });

      if (proofError) throw proofError;

      // Update task status
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          status: 'Completed',
          completed_at: now,
          updated_at: now,
          proof_photo_url: publicUrlData.publicUrl,
          completion_notes: data.notes
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      toast.success('Task completed successfully');
      onProofSubmitted();
      onClose();
    } catch (error) {
      console.error('Error submitting task proof:', error);
      toast.error('Failed to submit task proof');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-50 overflow-y-auto"
        onClose={onClose}
      >
        <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:h-screen sm:align-middle"
            aria-hidden="true"
          >
            &#8203;
          </span>

          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="relative inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
              <TaskSubmissionWithProof
                taskId={task.id}
                onSubmit={handleSubmit}
                onCancel={onClose}
              />
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 