export async function submitTaskWithProof(taskId: string, proofPhoto: string, notes: string) {
  try {
    const response = await fetch(`/api/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        proofPhoto,
        notes,
        submittedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit task');
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting task:', error);
    throw error;
  }
} 