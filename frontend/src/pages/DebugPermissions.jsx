import React, { useState, useEffect } from 'react';
import { usePermissions } from '../contexts/PermissionContext';
import axios from 'axios';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const DebugPermissions = () => {
  const { permissions, userRole, userId, loading } = usePermissions();
  const [rawApiData, setRawApiData] = useState(null);

  useEffect(() => {
    const fetchRawPermissions = async () => {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user && user.id) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.get(`${API}/users/${user.id}/permissions`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setRawApiData(response.data);
        } catch (error) {
          console.error('Failed to fetch raw permissions:', error);
        }
      }
    };

    fetchRawPermissions();
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
          🔍 Permissions Debug Page
        </h1>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">User Information</h2>
          <div className="space-y-2 text-gray-700 dark:text-gray-300">
            <p><strong>Name:</strong> {user.name}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Role:</strong> <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 rounded">{user.role}</span></p>
            <p><strong>User ID:</strong> <code className="text-sm">{user.id}</code></p>
          </div>
        </div>

        {/* Permissions from Context */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Permissions from Context {loading && '(Loading...)'}
          </h2>
          {permissions ? (
            <div className="space-y-2">
              {Object.entries(permissions).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{key}</span>
                  <span className={`px-3 py-1 rounded ${value ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}>
                    {value ? '✅ TRUE' : '❌ FALSE'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No permissions loaded</p>
          )}
        </div>

        {/* Raw API Response */}
        {rawApiData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Raw API Response</h2>
            <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded overflow-auto text-xs text-gray-800 dark:text-gray-200">
              {JSON.stringify(rawApiData, null, 2)}
            </pre>
          </div>
        )}

        {/* Chat Access Check */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Chat Access Check</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900 rounded">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Required Permissions for /chats:</p>
              <ul className="list-disc list-inside mt-2 text-blue-800 dark:text-blue-200">
                <li>can_have_direct_chat OR can_chat_with_millii (need at least ONE)</li>
              </ul>
            </div>
            
            {permissions && (
              <div className={`p-4 rounded ${
                permissions.can_have_direct_chat || permissions.can_chat_with_millii
                  ? 'bg-green-50 dark:bg-green-900'
                  : 'bg-red-50 dark:bg-red-900'
              }`}>
                <p className={`font-semibold ${
                  permissions.can_have_direct_chat || permissions.can_chat_with_millii
                    ? 'text-green-900 dark:text-green-100'
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {permissions.can_have_direct_chat || permissions.can_chat_with_millii
                    ? '✅ You SHOULD be able to access /chats'
                    : '❌ You CANNOT access /chats'}
                </p>
                <ul className="mt-2 space-y-1">
                  <li className={permissions.can_have_direct_chat ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}>
                    can_have_direct_chat: {permissions.can_have_direct_chat ? '✅' : '❌'}
                  </li>
                  <li className={permissions.can_chat_with_millii ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}>
                    can_chat_with_millii: {permissions.can_chat_with_millii ? '✅' : '❌'}
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 p-4">
          <p className="text-yellow-900 dark:text-yellow-100">
            <strong>💡 Tip:</strong> If the permissions look wrong, try logging out and logging back in to refresh them.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DebugPermissions;
