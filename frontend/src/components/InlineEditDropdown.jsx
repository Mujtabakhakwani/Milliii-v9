import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Inline editable dropdown component
 * Shows value with edit icon on hover
 * Opens dropdown on click for quick editing
 * Auto-saves on selection
 */
const InlineEditDropdown = ({ 
  value, 
  options, 
  onChange, 
  getColor, 
  getIcon,
  disabled = false,
  label = '',
  className = '',
  onOpenChange // NEW: Callback when dropdown opens/closes
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (onOpenChange) onOpenChange(true); // Notify parent
    } else {
      if (onOpenChange) onOpenChange(false); // Notify parent
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  const handleSelect = (newValue) => {
    if (newValue !== value && !disabled) {
      onChange(newValue);
    }
    setIsOpen(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const colorClass = getColor ? getColor(value) : '';
  const icon = getIcon ? getIcon(value) : null;

  return (
    <div 
      ref={dropdownRef}
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
          transition-all duration-200
          ${colorClass}
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'}
          ${isOpen ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        `}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span>{value}</span>
        {!disabled && (
          <ChevronDown 
            className={`w-3.5 h-3.5 transition-all duration-200 ${
              isHovered || isOpen ? 'opacity-100' : 'opacity-0'
            } ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-[9999] mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 max-h-60 overflow-y-auto">
          {label && (
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              {label}
            </div>
          )}
          {options.map((option) => {
            const optionColor = getColor ? getColor(option) : '';
            const optionIcon = getIcon ? getIcon(option) : null;
            const isSelected = option === value;
            
            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={`
                  w-full px-3 py-2 text-left text-sm flex items-center gap-2
                  hover:bg-gray-100 dark:hover:bg-gray-700
                  transition-colors duration-150
                  ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                `}
              >
                {optionIcon && <span className="flex-shrink-0">{optionIcon}</span>}
                <span className={`flex-1 ${optionColor}`}>{option}</span>
                {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InlineEditDropdown;
