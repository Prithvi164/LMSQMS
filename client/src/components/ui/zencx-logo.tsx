import React from 'react';

interface ZencxLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
}

export const ZencxLogo: React.FC<ZencxLogoProps> = ({ 
  className = "", 
  width = 160, 
  height = 60 
}) => {
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <img 
        src="/images/zencx-logo.png" 
        alt="ZENCX Logo" 
        className="w-full h-full object-contain"
        style={{ 
          filter: 'drop-shadow(0 0 8px rgba(0, 0, 0, 0.2))',
          backgroundColor: 'transparent'
        }}
      />
    </div>
  );
};