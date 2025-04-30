import { OpenAINode } from '../types/interfaces';
import { useState } from 'react';
import { CopyModal } from './CopyModal';

interface CopyButtonProps {
  nodes: OpenAINode[];
  onNodeClick?: (nodeId: string) => void;
  provider?: 'openai' | 'claude';
}

export const CopyButton = ({ nodes, onNodeClick, provider = 'openai' }: CopyButtonProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCopy = async (selectedNodeIds: string[]) => {
    const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id));
    const markdown = selectedNodes.map(node => {
      const role = node.data?.role === 'user' ? 'You' : 'Assistant';
      const content = node.data?.label || '';
      return `**${role}**: ${content}`;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(markdown);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      </button>

      {isModalOpen && (
        <CopyModal
          onClose={() => setIsModalOpen(false)}
          onCopy={handleCopy}
          nodes={nodes}
          onNodeClick={onNodeClick}
          provider={provider}
        />
      )}
    </>
  );
}; 