import React from 'react';

export const SynapseField: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
      {/* Subtle glowing ambient radial orbs */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[140px] opacity-10"
        style={{
          background: 'radial-gradient(circle, #4F46E5 0%, transparent 70%)',
          top: '10%',
          left: '15%',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[160px] opacity-10"
        style={{
          background: 'radial-gradient(circle, #059669 0%, transparent 70%)',
          top: '25%',
          right: '20%',
        }}
      />
      <div
        className="absolute w-[450px] h-[450px] rounded-full blur-[130px] opacity-10"
        style={{
          background: 'radial-gradient(circle, #D97706 0%, transparent 70%)',
          bottom: '10%',
          right: '10%',
        }}
      />

      {/* Grid pattern overlay */}
      <svg className="absolute inset-0 w-full h-full opacity-25" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="synapse-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#CBD5E1" strokeWidth="0.5" />
            <circle cx="0" cy="0" r="1" fill="#94A3B8" opacity="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#synapse-grid)" />
      </svg>
    </div>
  );
};
