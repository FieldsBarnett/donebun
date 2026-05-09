import React from "react";

interface PickerWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className: string;
  zIndex?: number;
}

export default function PickerWrapper({ 
  isOpen, 
  onClose, 
  children, 
  className,
  zIndex = 105 
}: PickerWrapperProps) {
  if (!isOpen) return null;
  
  return (
    <>
      <div 
        className="fixed inset-0 cursor-default" 
        style={{ zIndex }}
        onClick={(e) => { 
          e.stopPropagation(); 
          onClose(); 
        }} 
      />
      <div 
        className={className} 
        style={{ zIndex: zIndex + 5 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
