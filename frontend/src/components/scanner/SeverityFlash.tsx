import React, { useEffect, useState } from 'react';

interface SeverityFlashProps {
  color: string | null; // e.g. '#F44336'
}

export function SeverityFlash({ color }: SeverityFlashProps) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (color) {
      setActive(true);
      const timer = setTimeout(() => setActive(false), 600);
      return () => clearTimeout(timer);
    }
  }, [color]);

  if (!active || !color) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-40"
      style={{
        backgroundColor: color,
        animation: 'flash-fade 0.6s ease-out forwards',
      }}
    >
      <style>{`
        @keyframes flash-fade {
          0% { opacity: 0.35; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
