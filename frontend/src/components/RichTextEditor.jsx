import React, { useState, useRef, useEffect } from 'react';
import { Bold, Italic, List, Link, Code, Type } from 'lucide-react';

const RichTextEditor = ({ value, onChange, placeholder = "Enter text..." }) => {
  const editorRef = useRef(null);
  const [selectedFormats, setSelectedFormats] = useState(new Set());

  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    updateSelectedFormats();
    handleContentChange();
  };

  const updateSelectedFormats = () => {
    const formats = new Set();
    
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('insertUnorderedList')) formats.add('list');
    
    setSelectedFormats(formats);
  };

  const handleContentChange = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      onChange?.(content);
    }
  };

  const handleKeyDown = (e) => {
    // Handle common formatting shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          handleFormat('bold');
          break;
        case 'i':
          e.preventDefault();
          handleFormat('italic');
          break;
        case 'u':
          e.preventDefault();
          handleFormat('underline');
          break;
      }
    }
  };

  const ToolbarButton = ({ icon: Icon, command, value, title, active }) => (
    <button
      type="button"
      onClick={() => handleFormat(command, value)}
      className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
        active ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
      }`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center space-x-1 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-600">
        <ToolbarButton
          icon={Bold}
          command="bold"
          title="Bold (Ctrl+B)"
          active={selectedFormats.has('bold')}
        />
        <ToolbarButton
          icon={Italic}
          command="italic"
          title="Italic (Ctrl+I)"
          active={selectedFormats.has('italic')}
        />
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        <ToolbarButton
          icon={List}
          command="insertUnorderedList"
          title="Bullet List"
          active={selectedFormats.has('list')}
        />
        <ToolbarButton
          icon={Code}
          command="formatBlock"
          value="pre"
          title="Code Block"
        />
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-2" />
        <button
          type="button"
          onClick={() => {
            const url = prompt('Enter URL:');
            if (url) {
              handleFormat('createLink', url);
            }
          }}
          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-400"
          title="Insert Link"
        >
          <Link className="w-4 h-4" />
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleContentChange}
        onKeyUp={updateSelectedFormats}
        onMouseUp={updateSelectedFormats}
        onKeyDown={handleKeyDown}
        className="p-3 min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        style={{ whiteSpace: 'pre-wrap' }}
        suppressContentEditableWarning={true}
        data-placeholder={placeholder}
      />
      
      <style jsx>{`
        [contentEditable]:empty:before {
          content: attr(data-placeholder);
          color: #9CA3AF;
          font-style: italic;
        }
        [contentEditable] ul {
          list-style-type: disc;
          margin-left: 20px;
        }
        [contentEditable] ol {
          list-style-type: decimal;
          margin-left: 20px;
        }
        [contentEditable] pre {
          background-color: #f3f4f6;
          padding: 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: 0.875rem;
        }
        [contentEditable] a {
          color: #3b82f6;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;