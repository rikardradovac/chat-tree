import { useState, useRef, useEffect } from 'react';
import { ContextMenuProps } from '../types/interfaces';

export const ContextMenu = (props: ContextMenuProps) => {
    // Group state declarations
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState(props.role === 'user' ? (props.message || '') : '');
    const menuRef = useRef<HTMLDivElement>(null);

    chrome.runtime.sendMessage({
        action: "log",
        message: `
            Context Menu Props: ${JSON.stringify(props)}
        `
    });

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

    const handleActionClick = () => {
        if (props.role === 'user' || props.role === 'human') {
            setInputValue(props.message || '');
        } else {
            setInputValue('');
        }
        setShowInput(true);
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        await selectBranch();
        if (props.role === 'user' || props.role === 'human') {
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

        const action = props.provider === 'openai' ? 'editMessage' : 'editMessageClaude';
        const messageId = props.provider === 'openai' ? props.messageId : props.message;

        const response = await chrome.runtime.sendMessage({ 
            action: action, 
            messageId: messageId, 
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

        const childrenIds = props.provider === 'openai' ? props.childrenIds : props.childrenTexts;
        const action = props.provider === 'openai' ? 'respondToMessage' : 'respondToMessageClaude';

        const response = await chrome.runtime.sendMessage({ 
            action: action, 
            childrenIds: childrenIds, 
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

        const action = props.provider === 'openai' ? 'executeSteps' : 'executeStepsClaude';

        try {
            const execResponse = await chrome.runtime.sendMessage({ 
                action: action, 
                steps: steps,
                requireCompletion: true
            });

            if (!execResponse.completed) {
                throw new Error('Background operation did not complete successfully');
            }

            props.onRefresh();
            await chrome.runtime.sendMessage({ 
                action: props.provider === 'openai' ? "goToTarget" : "goToTargetClaude", 
                targetId: props.provider === 'openai' ? props.messageId : props.message 
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

    // Check if node has children based on provider
    const hasChildren = props.provider === 'openai' 
        ? props.childrenIds && props.childrenIds.length > 0
        : props.childrenTexts && props.childrenTexts.length > 0;

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
                {hasChildren && (
                    <button 
                        className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" 
                        onClick={handleActionClick}
                    >
                        {props.role === 'user' || props.role === 'human' ? 'Edit this message' : 'Respond to this message'}
                    </button>
                )}
                {showInput && (
                    <div className="mt-2">
                        <div className="relative flex flex-col">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.metaKey) {
                                        handleSend();
                                    }
                                }}
                                className="w-full px-4 py-2 text-sm text-gray-700 border rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[100px] resize-y"
                                placeholder={props.role === 'user' || props.role === 'human' ? "Edit message..." : "Type your response..."}
                                autoFocus
                            />
                            <div className="flex justify-between items-center mt-2">
                                <span className="text-xs text-gray-500">Press ⌘+Enter to send</span>
                                <button 
                                    onClick={handleSend}
                                    className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors disabled:opacity-50"
                                    disabled={!inputValue.trim()}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};