import React, { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveCard = ({ children, className = '' }: CardProps) => (
  <div className={`bg-white rounded-lg shadow-md p-3 sm:p-4 md:p-6 w-full ${className}`}>
    {children}
  </div>
);

interface GridProps {
  children: ReactNode;
  cols?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: number;
  className?: string;
}

export const ResponsiveGrid = ({ 
  children, 
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 4,
  className = '' 
}: GridProps) => {
  const getGridCols = () => {
    const colClasses = [];
    colClasses.push(`grid-cols-${cols.default}`);
    if (cols.sm) colClasses.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) colClasses.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) colClasses.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) colClasses.push(`xl:grid-cols-${cols.xl}`);
    return colClasses.join(' ');
  };

  return (
    <div className={`grid ${getGridCols()} gap-3 sm:gap-${gap} w-full ${className}`}>
      {children}
    </div>
  );
};

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveContainer = ({ children, className = '' }: ContainerProps) => (
  <div className={`w-full px-3 sm:px-4 md:px-6 lg:px-8 mx-auto max-w-[100vw] overflow-hidden ${className}`}>
    {children}
  </div>
);

interface FlexContainerProps {
  children: ReactNode;
  direction?: 'row' | 'col';
  className?: string;
}

export const ResponsiveFlex = ({ 
  children, 
  direction = 'row',
  className = '' 
}: FlexContainerProps) => (
  <div 
    className={`
      flex 
      flex-col 
      ${direction === 'row' ? 'sm:flex-row' : ''} 
      gap-3 
      sm:gap-4 
      w-full
      ${className}
    `}
  >
    {children}
  </div>
);

interface TableContainerProps {
  children: ReactNode;
  className?: string;
}

export const ResponsiveTable = ({ children, className = '' }: TableContainerProps) => (
  <div className="overflow-x-auto -mx-3 sm:mx-0">
    <div className="inline-block min-w-full align-middle px-3 sm:px-0">
      <div className={`overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg ${className}`}>
        {children}
      </div>
    </div>
  </div>
);

interface StatCardProps {
  icon: ReactNode;
  title: string;
  value: string | number;
  color?: 'indigo' | 'green' | 'blue' | 'purple' | 'pink';
}

export const StatCard = ({ icon, title, value, color = 'indigo' }: StatCardProps) => {
  const colorClasses = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
  };

  return (
    <div className={`rounded-lg p-3 sm:p-4 ${colorClasses[color]} touch-manipulation`}>
      <div className="flex items-center">
        <div className="p-2 flex-shrink-0">{icon}</div>
        <div className="ml-3 min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{title}</p>
          <p className={`text-xl sm:text-2xl font-semibold truncate ${color === 'indigo' ? 'text-indigo-900' : `text-${color}-900`}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}; 