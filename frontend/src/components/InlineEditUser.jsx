import React, { useState, useRef, useEffect } from 'react';
import { User, Check, X } from 'lucide-react';

/**
 * Inline editable user selector component
 * Shows assigned user with edit icon on hover
 * Opens user list on click
 * Auto-saves on selection
 */
const InlineEditUser = ({ 
  value, 
  users = [],
  onChange, 
  disabled = false,
  placeholder = 'Unassigned',
  className = '',
  projectTeamMembers = [] // NEW: Filter to only show project team members
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const userRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userRef.current && !userRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (userId) => {
    if (userId !== value && !disabled) {
      onChange(userId);
    }
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (!disabled) {
      onChange('');
      setIsOpen(false);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  // Filter users: only project team members and exclude clients
  const availableUsers = users.filter(user => {
    // Exclude clients
    if (user.role?.toLowerCase() === 'client') return false;
    
    // If projectTeamMembers is provided, only show those users
    if (projectTeamMembers && projectTeamMembers.length > 0) {
      return projectTeamMembers.includes(user.id) || projectTeamMembers.includes(user.email);
    }
    
    // Otherwise show all non-client users
    return true;
  });

  const assignedUser = availableUsers.find(u => u.id === value || u.email === value);
  
  const filteredUsers = availableUsers.filter(user => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  });

  const getUserInitials = (name) => {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const hasValue = value && value !== '';

  return (
    <div 
      ref={userRef}
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
            ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800' 
            : 'text-gray-500 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
          }
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:shadow-md'}
          ${isOpen ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        `}
      >
        {assignedUser ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-purple-600 dark:bg-purple-500 text-white text-xs flex items-center justify-center font-semibold">
              {getUserInitials(assignedUser.name)}
            </div>
            <span>{assignedUser.name}</span>
          </div>
        ) : (
          <>
            <User className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{placeholder}</span>
          </>
        )}
        {hasValue && !disabled && (isHovered || isOpen) && (
          <X 
            className="w-3.5 h-3.5 hover:text-red-600 transition-colors" 
            onClick={handleClear}
          />
        )}
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-[9999] mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 max-h-80 overflow-y-auto">
          {/* Search input */}
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users..."
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          {/* Clear/Unassign option */}
          {hasValue && (
            <button
              onClick={handleClear}
              className="w-full px-3 py-2 text-left text-sm flex items-center gap-2
                       hover:bg-gray-100 dark:hover:bg-gray-700 text-red-600 dark:text-red-400
                       border-b border-gray-200 dark:border-gray-700"
            >
              <X className="w-4 h-4" />
              <span>Unassign</span>
            </button>
          )}

          {/* User list */}
          {filteredUsers.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = user.id === value || user.email === value;
              
              return (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id || user.email)}
                  className={`
                    w-full px-3 py-2 text-left text-sm flex items-center gap-2
                    hover:bg-gray-100 dark:hover:bg-gray-700
                    transition-colors duration-150
                    ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                  `}
                >
                  <div className="w-6 h-6 rounded-full bg-purple-600 dark:bg-purple-500 text-white text-xs flex items-center justify-center font-semibold">
                    {getUserInitials(user.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default InlineEditUser;
