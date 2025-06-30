import React, { useEffect, useState } from 'react';
import { Suspense } from 'react';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Preload the logo image
    const img = new Image();
    img.src = '/Midiz.png';
    img.onload = () => setImageLoaded(true);

    // Start fade out after 1.5 seconds (reduced from 2.5)
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1500);

    // Complete splash screen after fade out (2 seconds total, reduced from 3)
    const finishTimer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-800 transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Main App Title */}
      <div className="text-center mb-8 animate-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Task Management System
        </h1>
        <p className="text-xl text-indigo-200">Streamline Your Workflow</p>
      </div>

      {/* MIDIZ Logo and Powered By Text */}
      <Suspense fallback={<div className="w-48 h-48 animate-pulse bg-indigo-500/50 rounded-lg" />}>
        <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          {/* MIDIZ Logo */}
          <div className="w-48 h-48 mx-auto mb-6 flex items-center justify-center">
            <img 
              src="/Midiz.png" 
              alt="MIDIZ Logo" 
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="eager"
              decoding="async"
            />
          </div>
          
          {/* Powered By Text */}
          <div className="text-white text-lg tracking-widest">
            POWERED BY <span className="font-bold text-cyan-400">MIDIZ</span>
          </div>
        </div>
      </Suspense>
    </div>
  );
} 