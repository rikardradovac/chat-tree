import { Node } from '../types/interfaces';
import { useState } from 'react';

interface ExportButtonProps {
  nodes: Node[];
  conversationData: any;
}

export const ExportButton = ({ nodes, conversationData }: ExportButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleExport = () => {
    // Filter out hidden nodes and sort by timestamp
    const visibleNodes = nodes
      .filter(node => !node.data?.hidden)
      .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));

    // Create markdown content
    let markdown = `# ${conversationData.title || 'ChatGPT Conversation'}\n\n`;
    markdown += `> Created on ${new Date(conversationData.create_time * 1000).toLocaleString()}\n\n`;

    // Add each message to the markdown
    visibleNodes.forEach(node => {
      const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
      const content = node.data?.label || '';
      const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
      const model = node.data?.model_slug ? ` (${node.data.model_slug})` : '';

      // Format the message with clear separation
      markdown += `\n\n<div class="message">\n\n`;
      markdown += `**${role}${model}**\n\n`;
      markdown += `${content}\n\n`;
      if (timestamp) {
        markdown += `> *${timestamp}*\n\n`;
      }
      markdown += `</div>\n\n`;
      markdown += `---\n\n`;
    });

    // Create and trigger download
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conversationData.title || 'chatgpt-conversation'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="absolute top-4 right-16 z-10">
      <button
        onClick={handleExport}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="bg-white p-2 rounded-full shadow-lg mt-2 hover:bg-gray-50 transition-all duration-200 flex items-center gap-2 group"
        title="Export conversation as markdown"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-5 w-5 text-gray-600 transition-transform duration-200 ${isHovered ? 'transform -translate-y-0.5' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
          />
        </svg>
        <span className="text-sm text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Export
        </span>
      </button>
    </div>
  );
}; 