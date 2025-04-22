import React, { useState, useRef, useEffect } from 'react';

interface ResizableChartProps {
  defaultHeight: number;
  defaultWidth?: string | number;
  minHeight?: number;
  minWidth?: number;
  maxHeight?: number;
  maxWidth?: number;
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
  onWidthChange?: (width: number) => void;
  onResize?: (dimensions: { width: number, height: number }) => void;
  className?: string;
}

export function ResizableChart({ 
  defaultHeight = 300, 
  defaultWidth = '100%', 
  minHeight = 200, 
  minWidth = 200,
  maxHeight = 800,
  maxWidth = 1200,
  children,
  onHeightChange,
  onWidthChange,
  onResize,
  className = ''
}: ResizableChartProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [width, setWidth] = useState(typeof defaultWidth === 'number' ? defaultWidth : '100%');
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingCorner, setIsResizingCorner] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startDimensionsRef = useRef({ 
    width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
    height 
  });

  // Handle height-only resize (bottom edge)
  const handleHeightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHeight(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startDimensionsRef.current = { 
      width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
      height 
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle width-only resize (right edge)
  const handleWidthResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingWidth(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startDimensionsRef.current = { 
      width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
      height 
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle corner resize (both dimensions)
  const handleCornerResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingCorner(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startDimensionsRef.current = { 
      width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0,
      height 
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingHeight && !isResizingWidth && !isResizingCorner) return;
    
    // Calculate deltas
    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    
    let newWidth = startDimensionsRef.current.width;
    let newHeight = startDimensionsRef.current.height;
    
    // Update dimensions based on which handle is being used
    if (isResizingHeight || isResizingCorner) {
      newHeight = Math.min(Math.max(startDimensionsRef.current.height + deltaY, minHeight), maxHeight);
    }
    
    if (isResizingWidth || isResizingCorner) {
      newWidth = Math.min(Math.max(startDimensionsRef.current.width + deltaX, minWidth), maxWidth);
    }
    
    // Apply changes
    if (isResizingHeight || isResizingCorner) {
      setHeight(newHeight);
      if (onHeightChange) onHeightChange(newHeight);
    }
    
    if (isResizingWidth || isResizingCorner) {
      setWidth(newWidth);
      if (onWidthChange) onWidthChange(newWidth);
    }
    
    // Notify of both dimension changes
    if (onResize) {
      onResize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsResizingHeight(false);
    setIsResizingWidth(false);
    setIsResizingCorner(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // Clean up event listeners on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHeight, isResizingWidth, isResizingCorner]);

  return (
    <div 
      ref={containerRef} 
      className={`relative ${className}`}
      style={{ 
        height: `${height}px`,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    >
      <div className="absolute inset-0 overflow-hidden">
        {children}
      </div>
      
      {/* Bottom resize handle (height) */}
      <div 
        className="absolute bottom-0 left-0 right-6 h-3 cursor-ns-resize bg-transparent hover:bg-primary/10 flex items-center justify-center z-10"
        onMouseDown={handleHeightResizeStart}
      >
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      
      {/* Right resize handle (width) */}
      <div 
        className="absolute top-0 bottom-6 right-0 w-3 cursor-ew-resize bg-transparent hover:bg-primary/10 flex items-center justify-center z-10"
        onMouseDown={handleWidthResizeStart}
      >
        <div className="h-10 w-1 bg-gray-300 rounded-full" />
      </div>
      
      {/* Corner resize handle (both) */}
      <div 
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize bg-transparent hover:bg-primary/10 flex items-center justify-center z-20"
        onMouseDown={handleCornerResizeStart}
      >
        <div className="w-4 h-4 bg-gray-300 rounded-sm flex items-center justify-center">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 7H7M0 5H5M0 3H3M0 1H1" stroke="#666" strokeWidth="1.5"/>
          </svg>
        </div>
      </div>
    </div>
  );
}