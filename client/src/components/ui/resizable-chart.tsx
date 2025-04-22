import React, { useState, useRef, useEffect } from 'react';

interface ResizableChartProps {
  defaultHeight: number;
  minHeight?: number;
  maxHeight?: number;
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
  className?: string;
}

export function ResizableChart({ 
  defaultHeight = 300, 
  minHeight = 200, 
  maxHeight = 800,
  children,
  onHeightChange,
  className = ''
}: ResizableChartProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(defaultHeight);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaY = e.clientY - startYRef.current;
    const newHeight = Math.min(Math.max(startHeightRef.current + deltaY, minHeight), maxHeight);
    
    setHeight(newHeight);
    if (onHeightChange) {
      onHeightChange(newHeight);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`relative ${className}`}
      style={{ height: `${height}px` }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {children}
      </div>
      
      {/* Resize handle */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize bg-transparent hover:bg-primary/10 flex items-center justify-center"
        onMouseDown={handleMouseDown}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
    </div>
  );
}