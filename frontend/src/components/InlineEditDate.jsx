import React, { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';

/**
 * Inline editable date picker component
 * Shows date with edit icon on hover
 * Opens date picker on click
 * Auto-saves on selection
 */
const InlineEditDate = ({ 
  value, 
  onChange, 
  disabled = false,
  placeholder = 'No date set',
  className = '',
  onOpenChange // NEW: Callback when date picker opens/closes
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dateRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dateRef.current && !dateRef.current.contains(event.target)) {
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

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    if (newDate && !disabled) {
      onChange(newDate);
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (!disabled) {
      onChange('');
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return placeholder;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const hasValue = value && value !== '';

  return (
    <div 
      ref={dateRef}
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
          ${hasValue 
            ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
            : 'text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'}
          ${isOpen ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        `}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{formatDate(value)}</span>
        {hasValue && !disabled && (isHovered || isOpen) && (
          <X 
            className="w-3.5 h-3.5 hover:text-red-600 transition-colors" 
            onClick={handleClear}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-[9999] mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2">
          <input
            type="date"
            value={value || ''}
            onChange={handleDateChange}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm
                     bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default InlineEditDate;
