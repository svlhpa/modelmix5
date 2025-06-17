import React from 'react';
import { Shuffle, Zap, Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl'
  };

  const iconSizes = {
    sm: 20,
    md: 24,
    lg: 32
  };

  if (variant === 'icon') {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <div className="relative p-1.5 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg">
            <Shuffle size={iconSizes[size] * 0.7} className="text-white" />
          </div>
          <Sparkles size={iconSizes[size] * 0.5} className="absolute -top-1 -right-1 text-yellow-500" />
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <span className={`font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent ${sizeClasses[size]} ${className}`}>
        ModelMix
      </span>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="relative">
        <div className="relative p-2 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl shadow-lg">
          <Shuffle size={iconSizes[size]} className="text-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
            <Sparkles size={8} className="text-yellow-800" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl blur-sm opacity-30 -z-10"></div>
      </div>
      <span className={`font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent ${sizeClasses[size]}`}>
        ModelMix
      </span>
    </div>
  );
};