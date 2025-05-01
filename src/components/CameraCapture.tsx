import React, { useRef, useState, useCallback } from 'react';
import { CameraIcon, XIcon } from '@heroicons/react/outline';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

export default function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>('');

  const startCamera = useCallback(async () => {
    try {
      // First, try to get the environment-facing camera (back camera)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }).catch(async () => {
        // If environment camera fails, try user-facing camera (front camera)
        return await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      });
      
      if (videoRef.current) {
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // Wait for the video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              if (videoRef.current) {
                videoRef.current.play()
                  .then(() => {
                    setIsStreaming(true);
                    setError('');
                    resolve();
                  })
                  .catch((err) => {
                    setError('Failed to start video stream. Please try again.');
                    console.error('Video play error:', err);
                  });
              }
            };
          }
        });
      }
    } catch (err) {
      setError('Unable to access camera. Please make sure you have granted camera permissions.');
      console.error('Camera access error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the current video frame on the canvas
      const context = canvas.getContext('2d');
      if (context) {
        // Flip the image horizontally if using front camera
        if (streamRef.current?.getVideoTracks()[0].getSettings().facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to base64 image data
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(imageData);
        stopCamera();
      }
    }
  }, [onCapture, stopCamera]);

  // Start camera when component mounts
  React.useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="relative safe-top bg-black px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="text-white p-2 rounded-lg hover:bg-gray-800 touch-manipulation"
          aria-label="Close camera"
        >
          <XIcon className="h-6 w-6" />
        </button>
        <h2 className="text-white text-lg font-medium">Take Photo</h2>
        <div className="w-10" /> {/* Spacer for alignment */}
      </div>

      {/* Camera View */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <p className="text-white text-center">{error}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{
                transform: streamRef.current?.getVideoTracks()[0].getSettings().facingMode === 'user' 
                  ? 'scaleX(-1)' 
                  : 'none'
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>

      {/* Capture Button */}
      <div className="safe-bottom bg-black px-4 py-6 flex justify-center">
        {isStreaming && !error && (
          <button
            onClick={capturePhoto}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center touch-manipulation"
            aria-label="Take photo"
          >
            <CameraIcon className="h-8 w-8 text-black" />
          </button>
        )}
      </div>
    </div>
  );
} 