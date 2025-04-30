import { OpenAINode } from '../types/interfaces';
import { useState } from 'react';

interface CopyModalProps {
  onClose: () => void;
  onCopy: (selectedNodeIds: string[]) => void;
  nodes: OpenAINode[];
  onNodeClick?: (nodeId: string) => void;
  provider?: 'openai' | 'claude';
}

export const CopyModal = ({ onClose, onCopy, nodes, onNodeClick, provider = 'openai' }: CopyModalProps) => {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [showCopied, setShowCopied] = useState(false);

  const visibleNodes = nodes.filter(node => !node.data?.hidden);

  const handleNodeToggle = (nodeId: string) => {
    setSelectedNodeIds(prev => {
      if (prev.includes(nodeId)) {
        return prev.filter(id => id !== nodeId);
      } else {
        return [...prev, nodeId];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedNodeIds(visibleNodes.map(node => node.id));
  };

  const handleDeselectAll = () => {
    setSelectedNodeIds([]);
  };

  const handleCopy = () => {
    onCopy(selectedNodeIds);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleContextMenu = async (e: React.MouseEvent, node: OpenAINode) => {
    e.preventDefault();
    if (onNodeClick) {
      try {
        await chrome.runtime.sendMessage({ 
          action: provider === 'openai' ? "goToTarget" : "goToTargetClaude", 
          targetId: provider === 'openai' ? node.id : node.data?.label
        });
      } catch (error) {
        console.error('Error navigating to target:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Copy Conversation</h3>
        <p className="text-sm text-gray-600 mb-4">
          Select the messages you want to copy to clipboard in markdown format.
          <br />
          <span className="text-xs text-gray-500">Right-click a message to navigate to it in the conversation.</span>
        </p>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Deselect All
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
          {visibleNodes.map(node => (
            <div
              key={node.id}
              className={`p-3 border-b border-gray-200 last:border-b-0 cursor-pointer transition-colors ${
                selectedNodeIds.includes(node.id)
                  ? 'bg-blue-100 hover:bg-blue-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => handleNodeToggle(node.id)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  {node.data?.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <span className="text-xs text-gray-500">
                  {node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : ''}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-700 line-clamp-2">
                {node.data?.label}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            disabled={selectedNodeIds.length === 0}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${
              selectedNodeIds.length === 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {showCopied ? 'Copied!' : 'Copy Selected'}
          </button>
        </div>
      </div>
    </div>
  );
}; 