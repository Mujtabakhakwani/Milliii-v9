// Utility functions for consistent avatar colors and initials across the app

// Generate consistent color based on user ID or email
export const getUserAvatarColor = (userId, email) => {
  // Use userId if available, otherwise use email
  const identifier = userId || email || 'default';
  
  // Simple hash function to convert string to number
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Define color palette (same as TeamMembers.jsx)
  const colors = [
    'bg-purple-500',
    'bg-blue-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-orange-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-violet-500'
  ];
  
  // Use hash to pick a consistent color
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

// Generate initials from name
export const getUserInitials = (name) => {
  if (!name) return '??';
  
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Get avatar props (color + initials) for a user
export const getUserAvatarProps = (user) => {
  if (!user) return { color: 'bg-gray-500', initials: '??' };
  
  return {
    color: getUserAvatarColor(user.id, user.email),
    initials: getUserInitials(user.name)
  };
};
