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
  const [showControls, setShowControls] = useState(true); // Always show controls by default
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startDimensionsRef = useRef({ 
    width: typeof width === 'number' ? width : containerRef.current?.clientWidth || 0, 
    height 
  });

  // When in responsive mode, resize on container changes
  useEffect(() => {
    if (!responsive || customMode) return;
    
    // Resize observer for container width changes
    const resizeObserver = new ResizeObserver(entries => {
      const containerWidth = entries[0].contentRect.width;
      if (typeof width !== 'string') {
        setWidth(containerWidth);
      }
    });
    
    // Immediately set width to match container on mount
    if (containerRef.current) {
      const parentWidth = containerRef.current.parentElement?.clientWidth || containerRef.current.clientWidth;
      if (typeof width !== 'string' && parentWidth > 0) {
        setWidth(parentWidth);
      }
      
      resizeObserver.observe(containerRef.current.parentElement || containerRef.current);
    }
    
    // Handle window resize events to ensure chart is responsive to viewport changes
    const handleWindowResize = () => {
      if (containerRef.current && typeof width !== 'string') {
        const parentWidth = containerRef.current.parentElement?.clientWidth || containerRef.current.clientWidth;
        if (parentWidth > 0) {
          setWidth(parentWidth);
        }
      }
    };
    
    window.addEventListener('resize', handleWindowResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
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
      onMouseLeave={() => customMode ? setShowControls(true) : setShowControls(false)}
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
            className="absolute bottom-0 left-0 right-8 h-8 cursor-ns-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-10"
            onMouseDown={handleHeightResizeStart}
          >
            <div className="w-24 h-3 bg-primary/80 rounded-full shadow-md" />
          </div>
          
          {/* Right resize handle (width) */}
          <div 
            className="absolute top-0 bottom-8 right-0 w-8 cursor-ew-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-10"
            onMouseDown={handleWidthResizeStart}
          >
            <div className="h-24 w-3 bg-primary/80 rounded-full shadow-md" />
          </div>
          
          {/* Corner resize handle (both) */}
          <div 
            className="absolute bottom-0 right-0 w-16 h-16 cursor-nwse-resize bg-transparent hover:bg-primary/20 flex items-center justify-center z-20"
            onMouseDown={handleCornerResizeStart}
          >
            <div className="w-10 h-10 bg-primary/80 rounded flex items-center justify-center shadow-md">
              <svg width="20" height="20" viewBox="0 0 8 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 7H7M0 5H5M0 3H3M0 1H1" stroke="white" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>
        </>
      )}
      
      {/* Always visible resize controls */}
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
          className={`px-2 py-1 rounded text-[11px] font-medium ${customMode ? 'bg-primary text-white' : 'bg-gray-600'}`}
        >
          {customMode ? 'Custom Size' : 'Auto Resize'}
        </button>
      </div>
      
      {/* Always visible instructional tooltip when in custom mode */}
      {customMode && (
        <div className="absolute bottom-16 right-4 bg-black/75 text-white text-xs py-1 px-2 rounded pointer-events-none" 
          style={{opacity: 0.8}}>
          <p>Drag edges or corner to resize</p>
        </div>
      )}
    </div>
  );
}