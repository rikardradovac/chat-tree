import { useState, useRef, useEffect } from 'react';
import { ContextMenuProps } from '../types/interfaces';

export const ContextMenu = (props: ContextMenuProps) => {
    // Group state declarations
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                props.onClick?.();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [props.onClick]);

    // Helper functions
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(event.target.value);
    };

    const handleActionClick = () => {
        setShowInput(true);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        await selectBranch();
        
        if (props.role === 'user') {
            await editMessage();
        } else if (props.role === 'assistant') {
            await respondToMessage();
        }
        
        setShowInput(false);
        setInputValue('');
        props.refreshNodes();
    };

    // API interaction functions
    const editMessage = async () => {
        if (props.hidden) {
            await selectBranch();
        }

        const response = await chrome.runtime.sendMessage({ 
            action: 'editMessage', 
            messageId: props.messageId, 
            message: inputValue,
            requireCompletion: true
        });
        
        if (!response.completed) {
            console.error('Edit message failed:', response.error);
            return;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        props.refreshNodes();
    };

    const respondToMessage = async () => {
        if (props.hidden) {
            await selectBranch();
        }

        const response = await chrome.runtime.sendMessage({ 
            action: 'respondToMessage', 
            childrenIds: props.childrenIds, 
            message: inputValue,
            requireCompletion: true
        });
        
        if (!response.completed) {
            console.error('Response message failed:', response.error);
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        props.refreshNodes();
    };

    const selectBranch = async () => {
        if (!props.messageId) return;

        const steps = props.onNodeClick(props.messageId);
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

            props.onRefresh();
            await chrome.runtime.sendMessage({ 
                action: "goToTarget", 
                targetId: props.messageId 
            });
        } catch (error) {
            console.error('Error executing steps:', error);
        }
    };

    // Render helpers
    const getPositionStyle = () => ({
        position: 'absolute' as const,
        top: typeof props.top === 'number' ? `${props.top}px` : undefined,
        left: typeof props.left === 'number' ? `${props.left}px` : undefined,
        right: typeof props.right === 'number' ? `${props.right}px` : undefined,
        bottom: typeof props.bottom === 'number' ? `${props.bottom}px` : undefined,
    });

    return (
        <div
            ref={menuRef}
            style={getPositionStyle()}
            className="bg-white shadow-lg rounded-lg p-3 z-50 min-w-[180px]"
            
        >
            {props.role && (
                <div className="px-2 py-1 text-xs text-gray-500 border-b border-gray-100">
                    Role: {props.role}
                </div>
            )}
            <div className="mt-1 space-y-1">
                <button 
                    className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" 
                    onClick={selectBranch}
                >
                    Select
                </button>
                <button 
                    className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" 
                    onClick={handleActionClick}
                >
                    {props.role === 'user' ? 'Edit this message' : 'Respond to this message'}
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
                                placeholder={props.role === 'user' ? "Edit message..." : "Type your response..."}
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
};