import { Node } from '../types/interfaces';
import { useState } from 'react';
import { ExportModal } from './ExportModal';

interface ExportButtonProps {
  nodes: Node[];
  conversationData: any;
}

export const ExportButton = ({ nodes, conversationData }: ExportButtonProps) => {
  const [showModal, setShowModal] = useState(false);

  const handleExport = (format: 'markdown' | 'xml' | 'obsidian') => {
    const visibleNodes = nodes
      .filter(node => !node.data?.hidden)
      .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      // Clean, simple markdown format
      content = `# ${conversationData.title || 'ChatGPT Conversation'}\n\n`;
      content += `Created on ${new Date(conversationData.create_time * 1000).toLocaleString()}\n\n---\n\n`;

      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
        const model = node.data?.model_slug ? ` (${node.data.model_slug})` : '';

        content += `## ${role}${model}\n\n${messageContent}\n\n`;
        if (timestamp) {
          content += `*${timestamp}*\n\n`;
        }
        content += '---\n\n';
      });

      filename = `${conversationData.title || 'chatgpt-conversation'}.md`;
      mimeType = 'text/markdown';
    } else if (format === 'obsidian') {
      // Obsidian-optimized format with callouts
      content = `# ${conversationData.title || 'ChatGPT Conversation'}\n\n`;
      content += `>[!info]- Conversation Info\n`;
      content += `>Created on ${new Date(conversationData.create_time * 1000).toLocaleString()}\n\n`;

      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
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

      filename = `${conversationData.title || 'chatgpt-conversation'}_obsidian.md`;
      mimeType = 'text/markdown';
    } else {
      // Create XML content
      content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      content += `<conversation title="${conversationData.title || 'ChatGPT Conversation'}" created="${new Date(conversationData.create_time * 1000).toISOString()}">\n`;
      
      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toISOString() : '';
        const model = node.data?.model_slug || '';

        content += `  <message role="${role}" model="${model}" timestamp="${timestamp}">\n`;
        content += `    <content><![CDATA[${messageContent}]]></content>\n`;
        content += `  </message>\n`;
      });

      content += `</conversation>`;
      filename = `${conversationData.title || 'chatgpt-conversation'}.xml`;
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
      <div className="absolute top-4 right-16 z-10">
        <button
          onClick={() => setShowModal(true)}
          className="bg-white p-2 rounded-full shadow-lg mt-2 hover:bg-gray-50 transition-colors"
          title="Export conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
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