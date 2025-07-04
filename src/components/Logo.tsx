import React from 'react';
import { Shuffle, Zap, Sparkles, Crown } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'full' | 'icon' | 'text';
  className?: string;
  showProCrown?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  size = 'md', 
  variant = 'full',
  className = '',
  showProCrown = false
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
          <div className="relative p-1.5 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 transform">
            <Shuffle size={iconSizes[size] * 0.7} className="text-white" />
          </div>
          <Sparkles size={iconSizes[size] * 0.5} className="absolute -top-1 -right-1 text-yellow-500 animate-pulse" />
          {showProCrown && (
            <Crown size={iconSizes[size] * 0.4} className="absolute -top-1 -left-1 text-yellow-400 animate-pulse" />
          )}
        </div>
      </div>
    );
  }

  if (variant === 'text') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className={`font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent ${sizeClasses[size]} hover:from-emerald-500 hover:to-blue-500 transition-all duration-300`}>
          ModelMix
        </span>
        {showProCrown && (
          <Crown size={iconSizes[size] * 0.6} className="text-yellow-400 animate-pulse" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className} group`}>
      <div className="relative">
        <div className="relative p-2 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110 transform">
          <Shuffle size={iconSizes[size]} className="text-white" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
            <Sparkles size={8} className="text-yellow-800" />
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl blur-sm opacity-30 -z-10 group-hover:opacity-50 transition-opacity duration-300"></div>
        {showProCrown && (
          <Crown size={iconSizes[size] * 0.5} className="absolute -top-2 -left-2 text-yellow-400 animate-pulse drop-shadow-lg" />
        )}
      </div>
      <span className={`font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent ${sizeClasses[size]} group-hover:from-emerald-500 group-hover:to-blue-500 transition-all duration-300`}>
        ModelMix
      </span>
    </div>
  );
};