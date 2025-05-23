import React from 'react';

interface CourtGraphicProps {
  isActive: boolean;
  courtNumber: number;
  onClick: () => void;
}

export default function CourtGraphic({ isActive, courtNumber, onClick }: CourtGraphicProps) {
  return (
    <button
      onClick={onClick}
      className={`w-64 h-64 relative group transition-all duration-300 ${
        isActive ? 'scale-105 transform' : 'hover:scale-102'
      }`}
      data-testid={`court-${courtNumber}-button`}
    >
      {/* Main court container */}
      <div className={`absolute inset-0 border-4 ${
        isActive ? 'border-blue-500 bg-blue-100' : 'border-gray-800 bg-gray-200'
      } transition-colors duration-300`}>
        {/* Court lines */}
        <div className="absolute inset-4 border-2 border-gray-800">
          {/* Center line */}
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-800 transform -translate-x-1/2" />
          
          {/* Service boxes */}
          <div className="absolute top-1/4 left-0 right-0 h-0.5 bg-gray-800" />
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800" />
          <div className="absolute top-3/4 left-0 right-0 h-0.5 bg-gray-800" />
          
          {/* Side service lines */}
          <div className="absolute top-1/4 bottom-1/4 left-1/4 w-0.5 bg-gray-800" />
          <div className="absolute top-1/4 bottom-1/4 right-1/4 w-0.5 bg-gray-800" />
        </div>

        {/* Retro pixel effect overlay */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
             style={{
               backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
             }} 
        />

        {/* Court number */}
        <div className={`absolute top-2 left-2 px-2 py-1 text-sm font-bold ${
          isActive ? 'bg-blue-500 text-white' : 'bg-gray-800 text-white'
        }`} style={{ 
          clipPath: 'polygon(0 0, 100% 0, 90% 100%, 10% 100%)',
          fontFamily: "'Press Start 2P', monospace"
        }}>
          COURT {courtNumber}
        </div>

        {/* Toggle status */}
        <div className={`absolute bottom-2 right-2 px-3 py-1 text-sm font-bold ${
          isActive ? 'bg-green-500' : 'bg-red-500'
        } text-white transform ${isActive ? 'rotate-2' : '-rotate-2'}`} style={{
          fontFamily: "'Press Start 2P', monospace"
        }}>
          {isActive ? 'ON' : 'OFF'}
        </div>
      </div>
    </button>
  );
} 