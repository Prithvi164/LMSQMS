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
  // New properties
  responsive?: boolean;
  customMode?: boolean;
  savePreferences?: (dimensions: { width: number, height: number }) => void;
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
  className = '',
  responsive = true,
  customMode = false,
  savePreferences
}: ResizableChartProps) {
  const [height, setHeight] = useState(defaultHeight);
  const [width, setWidth] = useState(typeof defaultWidth === 'number' ? defaultWidth : '100%');
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isResizingCorner, setIsResizingCorner] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startDimensionsRef = useRef({ 
    width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
    height 
  });

  // When in responsive mode, resize on container changes
  useEffect(() => {
    if (!responsive || customMode) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      const containerWidth = entries[0].contentRect.width;
      if (typeof width !== 'string') {
        setWidth(containerWidth);
      }
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current.parentElement || containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [responsive, customMode]);

  // Handle height-only resize (bottom edge)
  const handleHeightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!customMode) return;
    
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
    if (!customMode) return;
    
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
    if (!customMode) return;
    
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
    
    // Save preferences once resizing is complete
    if (savePreferences && customMode && typeof width === 'number') {
      savePreferences({ width, height });
    }
  };

  // Toggle custom mode
  const toggleCustomMode = () => {
    if (!customMode) {
      // If switching to custom mode, ensure width is a number
      if (typeof width === 'string') {
        const currentWidth = containerRef.current?.clientWidth || defaultHeight;
        setWidth(currentWidth);
      }
    }
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
      className={`relative ${className} ${isResizingHeight || isResizingWidth || isResizingCorner ? 'ring-2 ring-primary' : ''}`}
      style={{ 
        height: `${height}px`,
        width: typeof width === 'number' ? `${width}px` : width,
        transition: isResizingHeight || isResizingWidth || isResizingCorner ? 'none' : 'all 0.2s ease',
      }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <div className="absolute inset-0 overflow-hidden">
        {children}
      </div>
      
      {/* Overlay when resizing */}
      {(isResizingHeight || isResizingWidth || isResizingCorner) && (
        <div className="absolute inset-0 bg-primary/5 pointer-events-none z-10">
          <div className="absolute bottom-2 right-2 bg-primary text-white text-xs px-2 py-1 rounded">
            {Math.round(height)}px × {typeof width === 'number' ? `${Math.round(width)}px` : width}
          </div>
        </div>
      )}
      
      {/* Only show resize handles in custom mode */}
      {customMode && (
        <>
          {/* Bottom resize handle (height) */}
          <div 
            className="absolute bottom-0 left-0 right-6 h-6 cursor-ns-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-10"
            onMouseDown={handleHeightResizeStart}
          >
            <div className="w-20 h-2 bg-gray-400 rounded-full" />
          </div>
          
          {/* Right resize handle (width) */}
          <div 
            className="absolute top-0 bottom-6 right-0 w-6 cursor-ew-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-10"
            onMouseDown={handleWidthResizeStart}
          >
            <div className="h-20 w-2 bg-gray-400 rounded-full" />
          </div>
          
          {/* Corner resize handle (both) */}
          <div 
            className="absolute bottom-0 right-0 w-12 h-12 cursor-nwse-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-20"
            onMouseDown={handleCornerResizeStart}
          >
            <div className="w-8 h-8 bg-gray-400 rounded-sm flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 7H7M0 5H5M0 3H3M0 1H1" stroke="#444" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>
        </>
      )}
      
      {/* Size indicator and control buttons */}
      {showControls && (
        <div className="absolute top-2 right-2 bg-black/75 text-white text-xs px-2 py-1 rounded opacity-80 z-30 flex items-center gap-2">
          <span>{Math.round(height)}px × {typeof width === 'number' ? `${Math.round(width)}px` : 'auto'}</span>
          <button 
            onClick={() => {
              const newCustomMode = !customMode;
              toggleCustomMode();
              if (onResize) {
                onResize({ 
                  width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
                  height 
                });
              }
            }}
            className={`px-1 py-0.5 rounded text-[10px] ${customMode ? 'bg-primary' : 'bg-gray-600'}`}
          >
            {customMode ? 'Custom' : 'Auto'}
          </button>
        </div>
      )}
      
      {/* Instructional tooltip that appears briefly on hover */}
      {customMode && showControls && (
        <div className="absolute bottom-16 right-4 bg-black/75 text-white text-xs py-1 px-2 rounded pointer-events-none opacity-0 transition-opacity duration-500 hover:opacity-100" 
          style={{animation: 'fadeInOut 3s ease-in-out'}}>
          <p>Drag edges or corner to resize</p>
        </div>
      )}
    </div>
  );
}