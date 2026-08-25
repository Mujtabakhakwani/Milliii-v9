import React, { useRef, useState, useEffect } from 'react';
import { Send, Bold, Italic, Smile, Paperclip } from 'lucide-react';
import './RichTextInput.css';

const RichTextInput = ({ 
  value, 
  onChange, 
  onSend, 
  placeholder = "Type a message...", 
  disabled = false,
  onEmojiClick,
  onFileClick,
  onAtMention,
  showEmojiPicker = false,
  uploadingFile = false
}) => {
  const editorRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false });

  // Update editor content when value changes externally
  useEffect(() => {
    if (editorRef.current) {
      // If value is empty or contains only HTML whitespace/tags, clear the editor
      const strippedValue = value?.replace(/<[^>]*>/g, '').trim();
      if (!value || strippedValue === '') {
        editorRef.current.innerHTML = '';
        return;
      }
      
      // Only update if not currently focused to avoid cursor issues
      if (document.activeElement !== editorRef.current) {
        const currentCursorPos = saveCursorPosition();
        editorRef.current.innerHTML = value || '';
        if (currentCursorPos && isFocused) {
          restoreCursorPosition(currentCursorPos);
        }
      }
    }
  }, [value, isFocused]);

  // Check active formatting on selection change
  useEffect(() => {
    const updateFormats = () => {
      if (isFocused && editorRef.current) {
        setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic')
        });
      }
    };

    document.addEventListener('selectionchange', updateFormats);
    return () => document.removeEventListener('selectionchange', updateFormats);
  }, [isFocused]);

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0);
    }
    return null;
  };

  const restoreCursorPosition = (range) => {
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const handleInput = () => {
    if (editorRef.current && onChange) {
      const content = editorRef.current.innerHTML;
      onChange(content);
      
      // Check for @ mention
      const text = editorRef.current.innerText;
      const cursorPos = window.getSelection().anchorOffset;
      const textBeforeCursor = text.substring(0, cursorPos);
      const lastAtIndex = textBeforeCursor.lastIndexOf('@');
      
      if (lastAtIndex !== -1 && onAtMention) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Only show mentions if there's no space after @
        if (!textAfterAt.includes(' ')) {
          onAtMention(true, textAfterAt);
        } else {
          onAtMention(false);
        }
      } else if (onAtMention) {
        onAtMention(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (onSend && value?.replace(/<[^>]*>/g, '').trim()) {
        onSend();
      }
    }

    // Format shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b') {
        e.preventDefault();
        execCommand('bold');
      } else if (e.key === 'i') {
        e.preventDefault();
        execCommand('italic');
      }
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
    // Update active formats immediately after command
    setTimeout(() => {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic')
      });
    }, 0);
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  };

  const insertText = (text) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, text);
    handleInput();
  };

  return (
    <div className="rich-text-input-container">
      <div className={`rich-text-wrapper ${isFocused ? 'focused' : ''}`}>
        {/* Toolbar */}
        <div className="rich-text-toolbar">
          <button
            type="button"
            onClick={() => execCommand('bold')}
            className={`toolbar-button ${activeFormats.bold ? 'active' : ''}`}
            title="Bold (Ctrl/Cmd + B)"
            disabled={disabled}
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => execCommand('italic')}
            className={`toolbar-button ${activeFormats.italic ? 'active' : ''}`}
            title="Italic (Ctrl/Cmd + I)"
            disabled={disabled}
          >
            <Italic className="w-4 h-4" />
          </button>
          
          <div className="toolbar-divider"></div>
          
          {/* Emoji Picker */}
          <button
            type="button"
            onClick={onEmojiClick}
            className={`toolbar-button ${showEmojiPicker ? 'active' : ''}`}
            title="Add Emoji"
            disabled={disabled}
          >
            <Smile className="w-4 h-4" />
          </button>
          
          {/* File Attachment */}
          <button
            type="button"
            onClick={onFileClick}
            className="toolbar-button"
            title="Attach File"
            disabled={disabled || uploadingFile}
          >
            <Paperclip className="w-4 h-4" />
          </button>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="rich-text-editor"
          data-placeholder={placeholder}
          suppressContentEditableWarning
        />
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={disabled || !value?.replace(/<[^>]*>/g, '').trim()}
        className="send-button"
        title="Send message (Enter)"
      >
        <Send className="w-5 h-5" />
      </button>
    </div>
  );
};

export default RichTextInput;
