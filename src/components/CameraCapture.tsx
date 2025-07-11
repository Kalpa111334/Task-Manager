import React, { useRef, useState, useCallback } from 'react';
import { CameraIcon, XIcon, SwitchHorizontalIcon } from '@heroicons/react/outline';

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
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const checkDevices = useCallback(async () => {
    try {
      // First, request permission
      await navigator.mediaDevices.getUserMedia({ video: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
      
      // If no back camera is found on mobile, switch to front camera
      if (videoDevices.length > 0 && !videoDevices.some(device => device.label.toLowerCase().includes('back'))) {
        setFacingMode('user');
      }
    } catch (err) {
      console.error('Error checking devices:', err);
      setHasMultipleCameras(false);
      // If permission is denied, show a clear error message
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Camera access denied. Please enable camera permissions in your browser settings.');
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError('');

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Try to match the device pixel ratio for better quality
      const pixelRatio = window.devicePixelRatio || 1;
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 * pixelRatio },
          height: { ideal: 1080 * pixelRatio },
          frameRate: { ideal: 30 }
        },
        audio: false
      };

      // Add a timeout to the getUserMedia call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Camera initialization timeout')), 10000);
      });

      const stream = await Promise.race([
        navigator.mediaDevices.getUserMedia(constraints),
        timeoutPromise
      ]) as MediaStream;

      if (!videoRef.current) return;

      streamRef.current = stream;
      videoRef.current.srcObject = stream;

      // Wait for the video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!videoRef.current) return reject();

        const timeoutId = setTimeout(() => {
          reject(new Error('Video loading timeout'));
        }, 10000);

        videoRef.current.onloadedmetadata = () => {
          clearTimeout(timeoutId);
          if (!videoRef.current) return reject();

          videoRef.current.play()
            .then(() => {
              setIsStreaming(true);
              setError('');
              resolve();
            })
            .catch((err) => {
              console.error('Video play error:', err);
              reject(err);
            });
        };
      });

      // Check for available cameras after successfully starting the stream
      await checkDevices();
    } catch (err) {
      console.error('Camera access error:', err);
      
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('Camera access denied. Please enable camera permissions in your browser settings.');
            break;
          case 'NotFoundError':
            setError('No camera found. Please make sure your device has a camera.');
            break;
          case 'NotReadableError':
            setError('Camera is already in use by another application.');
            break;
          default:
            if (facingMode === 'environment') {
              setFacingMode('user');
              setError('Back camera not available. Switching to front camera...');
              // Try again with front camera
              setTimeout(() => startCamera(), 1000);
            } else {
              setError('Unable to access camera. Please check your camera settings and try again.');
            }
        }
      } else {
        setError('Failed to initialize camera. Please try again.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [facingMode, checkDevices]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.error('Error stopping track:', err);
        }
      });
      streamRef.current = null;
    }
    setIsStreaming(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const switchCamera = useCallback(async () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    await startCamera();
  }, [startCamera]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Use the actual video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        // Clear the canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        if (facingMode === 'user') {
          context.translate(canvas.width, 0);
          context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset transformation
        if (facingMode === 'user') {
          context.setTransform(1, 0, 0, 1, 0, 0);
        }
        
        const imageData = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(imageData);
        stopCamera();
      }
    }
  }, [onCapture, stopCamera, facingMode]);

  React.useEffect(() => {
    const initCamera = async () => {
      try {
        await checkDevices();
        await startCamera();
      } catch (err) {
        console.error('Camera initialization error:', err);
      }
    };

    initCamera();

    return () => {
      stopCamera();
    };
  }, [checkDevices, startCamera, stopCamera]);

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
        {hasMultipleCameras && (
          <button
            onClick={switchCamera}
            className="text-white p-2 rounded-lg hover:bg-gray-800 touch-manipulation"
            aria-label="Switch camera"
          >
            <SwitchHorizontalIcon className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Camera View */}
      <div className="flex-1 relative bg-black">
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
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                display: isInitializing ? 'none' : 'block'
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capture Button */}
      <div className="safe-bottom bg-black px-4 py-6 flex justify-center">
        {isStreaming && !error && !isInitializing && (
          <button
            onClick={capturePhoto}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center touch-manipulation transform active:scale-95 transition-transform"
            aria-label="Take photo"
          >
            <CameraIcon className="h-8 w-8 text-black" />
          </button>
        )}
      </div>
    </div>
  );
} 