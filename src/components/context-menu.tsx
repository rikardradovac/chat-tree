interface ContextMenuProps {
  role?: string;
  messageId?: string;
  childrenIds?: string[];
  top: number | boolean;
  left: number | boolean;
  right: number | boolean;
  bottom: number | boolean;
  hidden?: boolean;
  onClick?: () => void;
  onNodeClick: (messageId: string) => void;
  onRefresh: () => void;
}

export default function ContextMenu({
  role,
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
  ...props
}: ContextMenuProps) {


    const editMessage = async () => {
        if (hidden) {
            await selectBranch();
        }
        chrome.runtime.sendMessage({ action: 'editMessage', messageId: messageId });
    }
    const respondToMessage = async () => {
        if (hidden) {
            await selectBranch();
        }
        chrome.runtime.sendMessage({ action: 'respondToMessage', childrenIds: childrenIds });
    }

    const selectBranch = async () => {
        if (messageId) {
            const steps = onNodeClick(messageId);
            try {
                await chrome.runtime.sendMessage({ action: "executeSteps", steps: steps });
                onRefresh();
                await chrome.runtime.sendMessage({ action: "goToTarget", targetId: messageId });
            } catch (error) {
                console.error('Error executing steps:', error);
            }
        }
    }

  return (
    <div
      style={{ 
        position: 'absolute',
        top: typeof top === 'number' ? `${top}px` : undefined,
        left: typeof left === 'number' ? `${left}px` : undefined,
        right: typeof right === 'number' ? `${right}px` : undefined,
        bottom: typeof bottom === 'number' ? `${bottom}px` : undefined,
      }}
      className="bg-white shadow-lg rounded-lg p-3 z-50 min-w-[180px]"
      onClick={onClick}
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
        {role === "assistant" && (
            <button className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" onClick={respondToMessage}>
                Respond to this message
            </button>
        )}
        {role === "user" && (
            <button className="w-full px-2 py-1.5 text-sm text-left text-gray-700 hover:bg-gray-50 rounded transition-colors" onClick={editMessage}>
                Edit this message
            </button>
        )}
      </div>
    </div>
  );
}