import React from 'react';
import Webcam from 'react-webcam';

interface CameraViewProps {
  webcamRef: React.RefObject<Webcam>;
}

export function CameraView({ webcamRef }: CameraViewProps) {
  return (
    <div className="absolute inset-0 bg-black overflow-hidden flex items-center justify-center">
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={{
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }}
        mirrored={false}
        className="h-full w-full object-cover"
      />
    </div>
  );
}
