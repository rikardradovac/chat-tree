import { ClaudeNode, ClaudeContentBlock } from '../types/interfaces';
import { useState } from 'react';
import { ExportModal } from './ExportModal';

interface ExportButtonClaudeProps {
  nodes: ClaudeNode[];
  conversationData: any;
  className?: string;
}

export const ExportButtonClaude = ({ nodes, conversationData, className }: ExportButtonClaudeProps) => {
  const [showModal, setShowModal] = useState(false);

  const processMessageContent = (contentBlocks: ClaudeContentBlock[]) => {
    if (!contentBlocks || contentBlocks.length === 0) return '';
    
    return contentBlocks
      .filter(block => block.type === 'text') // Only process text blocks for now
      .map(block => block.text)
      .join('\n\n');
  };
  
  const handleExport = (format: 'markdown' | 'xml' | 'obsidian') => {
    const visibleNodes = nodes
      .filter(node => !node.data?.hidden)
      .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = `# ${conversationData.name || 'Claude Conversation'}\n\n`;
      content += `Created on ${new Date(conversationData.created_at).toLocaleString()}\n\n---\n\n`;

      visibleNodes.forEach(node => {
        const role = node.data?.role === 'human' ? 'You' : 'Assistant';
        const messageContent = processMessageContent(node.message?.content || []);
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
        const model = node.data?.model_slug ? ` (${node.data.model_slug})` : '';

        content += `## ${role}${model}\n\n${messageContent}\n\n`;
        if (timestamp) {
          content += `*${timestamp}*\n\n`;
        }
        content += '---\n\n';
      });

      filename = `${conversationData.name || 'claude-conversation'}.md`;
      mimeType = 'text/markdown';
    } else if (format === 'obsidian') {
      content = `# ${conversationData.name || 'Claude Conversation'}\n\n`;
      content += `>[!info]- Conversation Info\n`;
      content += `>Created on ${new Date(conversationData.created_at).toLocaleString()}\n\n`;

      visibleNodes.forEach(node => {
        const role = node.data?.role === 'human' ? 'You' : 'Assistant';
        const messageContent = processMessageContent(node.message?.content || []);
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
        const model = node.data?.model_slug ? ` using ${node.data.model_slug}` : '';

        if (role === 'You') {
          content += `>[!question] You\n`;
        } else {
          content += `>[!note] Assistant${model}\n`;
        }
        
        content += messageContent.split('\n').map(line => `>${line}`).join('\n');
        content += '\n\n';
        
        if (timestamp) {
          content += `^[${timestamp}]\n\n`;
        }
      });

      filename = `${conversationData.name || 'claude-conversation'}_obsidian.md`;
      mimeType = 'text/markdown';
    } else {
      // XML format
      content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      content += `<conversation title="${conversationData.name || 'Claude Conversation'}" created="${new Date(conversationData.created_at).toISOString()}">\n`;

      visibleNodes.forEach(node => {
        const role = node.data?.role === 'human' ? 'You' : 'Assistant';
        const messageContent = processMessageContent(node.message?.content || []);
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toISOString() : '';
        const model = node.data?.model_slug || '';

        content += `  <message role="${role}" model="${model}" timestamp="${timestamp}">\n`;
        content += `    <content><![CDATA[${messageContent}]]></content>\n`;
        content += `  </message>\n`;
      });

      content += `</conversation>`;
      filename = `${conversationData.name || 'claude-conversation'}.xml`;
      mimeType = 'application/xml';
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowModal(false);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || "p-2.5 hover:bg-gray-50 transition-colors group"}
        title="Export conversation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 group-hover:text-gray-800" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {showModal && (
        <ExportModal
          onClose={() => setShowModal(false)}
          onExport={handleExport}
          visibleNodesCount={nodes.filter(node => !node.data?.hidden).length}
        />
      )}
    </>
  );
};
