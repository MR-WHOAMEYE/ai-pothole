import React from 'react';

export function ScanOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      {/* Target Reticle brackets (pulsing cyan) */}
      <div className="relative w-72 h-72 sm:w-80 sm:h-80 border border-zinc-800/30 flex items-center justify-center">
        {/* Top-Left Bracket */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-400 rounded-tl-sm animate-pulse-opacity" />
        
        {/* Top-Right Bracket */}
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-400 rounded-tr-sm animate-pulse-opacity" />
        
        {/* Bottom-Left Bracket */}
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-400 rounded-bl-sm animate-pulse-opacity" />
        
        {/* Bottom-Right Bracket */}
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-400 rounded-br-sm animate-pulse-opacity" />
        
        {/* Scanning Laser Line */}
        <div className="absolute left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-scan" />
        
        {/* Subtle grid pattern helper */}
        <div className="text-[10px] text-cyan-400/40 uppercase tracking-widest font-mono select-none animate-pulse-opacity">
          Ready to scan
        </div>
      </div>
    </div>
  );
}
