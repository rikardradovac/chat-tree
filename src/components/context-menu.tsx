import { useState, useRef, useEffect } from 'react';

interface ContextMenuProps {
  role?: string;
  message: string;
  messageId?: string;
  childrenIds?: string[];
  top: number | boolean;
  left: number | boolean;
  right: number | boolean;
  bottom: number | boolean;
  hidden?: boolean;
  onClick?: () => void;
  onNodeClick: (messageId: string) => any[];
  onRefresh: () => void;
  refreshNodes: () => void;
}

export default function ContextMenu({
  role,
  message,
  messageId,
  childrenIds,
  top,
  left,
  right,
  bottom,
  hidden,
  onClick,
  onNodeClick,
  onRefresh,
  refreshNodes,
  ...props
}: ContextMenuProps) {

    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');
    
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClick?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClick]);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        await selectBranch();
        
        if (role === 'user') {
            await editMessage();
        } else if (role === 'assistant') {
            await respondToMessage();
        }
        
        
        setShowInput(false);
        setInputValue('');

        refreshNodes()
    };

    const handleActionClick = () => {
        setShowInput(true);
    };

    const editMessage = async () => {
        if (hidden) {
            await selectBranch();
        }
        const response = await chrome.runtime.sendMessage({ 
            action: 'editMessage', 
            messageId: messageId, 
            message: inputValue,
            requireCompletion: true
        });
        
        if (!response.completed) {
            console.error('Edit message failed:', response.error);
            return;
        }
        
        // sleep for a while before updating
        await new Promise(resolve => setTimeout(resolve, 2000));
        refreshNodes();
    };

    const respondToMessage = async () => {
        if (hidden) {
            await selectBranch();
        }
        const response = await chrome.runtime.sendMessage({ 
            action: 'respondToMessage', 
            childrenIds: childrenIds, 
            message: inputValue,
            requireCompletion: true
        });
        
        if (!response.completed) {
            console.error('Response message failed:', response.error);
            return;
        }

         // sleep for a while before updating
        await new Promise(resolve => setTimeout(resolve, 2000));
        refreshNodes();
    };

    const selectBranch = async () => {
        if (messageId) {
            const steps = onNodeClick(messageId);
            if (!steps) return;
            try {
                const execResponse = await chrome.runtime.sendMessage({ 
                    action: "executeSteps", 
                    steps: steps,
                    requireCompletion: true
                });

                if (!execResponse.completed) {
                    throw new Error('Background operation did not complete successfully');
                }

                onRefresh();
                await chrome.runtime.sendMessage({ action: "goToTarget", targetId: messageId });
            } catch (error) {
                console.error('Error executing steps:', error);
            }
        }
    }

  return (
    <div
      ref={menuRef}
      style={{ 
        position: 'absolute',
        top: typeof top === 'number' ? `${top}px` : undefined,
        left: typeof left === 'number' ? `${left}px` : undefined,
        right: typeof right === 'number' ? `${right}px` : undefined,
        bottom: typeof bottom === 'number' ? `${bottom}px` : undefined,
      }}
      className="bg-white shadow-lg rounded-lg p-3 z-50 min-w-[180px]"
      {...props}
    >
      {role && (
        <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-100">
          Role: {role}
        </div>
      )}
      <div className="mt-1 space-y-1">
        <button className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" onClick={selectBranch}>
            Select
        </button>
        <button 
            className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" 
            onClick={handleActionClick}
        >
            {role === 'user' ? 'Edit this message' : 'Respond to this message'}
        </button>
        {showInput && (
            <div className="mt-2">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="w-full px-4 py-2 pr-10 text-sm text-gray-700 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder={role === 'user' ? "Edit message..." : "Type your response..."}
                        autoFocus
                    />
                    <button 
                        onClick={handleSend}
                        className="absolute right-2 p-1 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                        disabled={!inputValue.trim()}
                    >
                        <span className="text-xl">➔</span>
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}