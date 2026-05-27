import React, { useState, useEffect } from 'react';

interface BboxCanvasProps {
  bboxX: number;
  bboxY: number;
  bboxWidth: number;
  bboxHeight: number;
  color: string;
  label?: string;
  imageRef: React.RefObject<HTMLImageElement>;
}

export function BboxCanvas({ bboxX, bboxY, bboxWidth, bboxHeight, color, label, imageRef }: BboxCanvasProps) {
  const [coords, setCoords] = useState<{ left: string; top: string; width: string; height: string } | null>(null);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    const updateScale = () => {
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const displayW = img.clientWidth;
      const displayH = img.clientHeight;

      if (!naturalW || !naturalH || !displayW || !displayH) return;

      const scaleX = displayW / naturalW;
      const scaleY = displayH / naturalH;

      setCoords({
        left: `${bboxX * scaleX}px`,
        top: `${bboxY * scaleY}px`,
        width: `${bboxWidth * scaleX}px`,
        height: `${bboxHeight * scaleY}px`,
      });
    };

    if (img.complete) {
      updateScale();
    } else {
      img.addEventListener('load', updateScale);
    }

    // Set up a resize listener to handle browser resizing
    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(img);

    return () => {
      img.removeEventListener('load', updateScale);
      resizeObserver.disconnect();
    };
  }, [bboxX, bboxY, bboxWidth, bboxHeight, imageRef]);

  if (!coords) return null;

  return (
    <div
      className="absolute border-2 rounded-sm pointer-events-none z-10 font-mono text-[9px] flex items-start"
      style={{
        borderColor: color,
        left: coords.left,
        top: coords.top,
        width: coords.width,
        height: coords.height,
        boxShadow: `0 0 6px ${color}80`,
      }}
    >
      {label && (
        <span
          className="absolute -top-5 left-[-2px] text-zinc-950 px-1.5 py-0.5 rounded-t-sm text-[8px] font-bold uppercase"
          style={{ backgroundColor: color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
