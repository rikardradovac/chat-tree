import { OpenAINode } from '../types/interfaces';
import { useState } from 'react';
import { ExportModal } from './ExportModal';

interface ExportButtonProps {
  nodes: OpenAINode[];
  conversationData: any;
  className?: string;
}

export const ExportButton = ({ nodes, conversationData, className }: ExportButtonProps) => {
  const [showModal, setShowModal] = useState(false);

  const processMessageContent = (content: string, citations: any[], format: 'markdown' | 'obsidian') => {
    if (!citations || citations.length === 0) return content;

    // Sort citations by start_ix to process them in order
    const sortedCitations = [...citations].sort((a, b) => a.start_ix - b.start_ix);
    
    // Process citations from end to start to avoid index shifting
    let processedContent = content;
    for (let i = sortedCitations.length - 1; i >= 0; i--) {
      const citation = sortedCitations[i];
      const { start_ix, end_ix, metadata } = citation;
      
      // Extract the cited text
      const citedText = content.substring(start_ix, end_ix);
      
      // Create the reference based on format
      const reference = format === 'markdown' 
        ? `[${citedText}](${metadata.url})`
        : `[[${citedText}]](${metadata.url})`;
      
      // Replace the text with the reference
      processedContent = processedContent.substring(0, start_ix) + 
                        reference + 
                        processedContent.substring(end_ix);
    }

    // Remove any remaining citation placeholders (like 【32†L307-L315】)
    processedContent = processedContent.replace(/【\d+†L\d+-L\d+】/g, '');

    return processedContent;
  };

  const handleExport = (format: 'markdown' | 'xml' | 'obsidian') => {
    const visibleNodes = nodes
      .filter(node => !node.data?.hidden)
      .sort((a, b) => (a.data?.timestamp || 0) - (b.data?.timestamp || 0));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = `# ${conversationData.title || 'ChatGPT Conversation'}\n\n`;
      content += `Created on ${new Date(conversationData.create_time * 1000).toLocaleString()}\n\n---\n\n`;

      // Collect all citations from all messages
      const allCitations: any[] = [];

      // First pass: collect all citations
      visibleNodes.forEach(node => {
        const citations = node.message?.metadata?.citations || [];
        allCitations.push(...citations);
      });

      // Second pass: process messages and add to content
      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
        const model = node.data?.model_slug ? ` (${node.data.model_slug})` : '';
        const citations = node.message?.metadata?.citations || [];

        // Process the message content to replace citation markers with references
        const processedContent = processMessageContent(messageContent, citations, format);

        content += `## ${role}${model}\n\n${processedContent}\n\n`;
        if (timestamp) {
          content += `*${timestamp}*\n\n`;
        }
        content += '---\n\n';
      });

      // Add references section at the very bottom after all messages
      if (allCitations.length > 0) {
        content += '\n---\n\n## References\n\n';
        allCitations.forEach((citation, index) => {
          const metadata = citation.metadata;
          const citedText = citation.text || '';
          content += `${index + 1}. [${metadata.title}](${metadata.url})\n   > ${citedText}\n\n`;
        });
      }

      filename = `${conversationData.title || 'chatgpt-conversation'}.md`;
      mimeType = 'text/markdown';
    } else if (format === 'obsidian') {
      content = `# ${conversationData.title || 'ChatGPT Conversation'}\n\n`;
      content += `>[!info]- Conversation Info\n`;
      content += `>Created on ${new Date(conversationData.create_time * 1000).toLocaleString()}\n\n`;

      // Collect all citations from all messages
      const allCitations: any[] = [];

      // First pass: collect all citations
      visibleNodes.forEach(node => {
        const citations = node.message?.metadata?.citations || [];
        allCitations.push(...citations);
      });

      // Second pass: process messages and add to content
      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toLocaleString() : '';
        const model = node.data?.model_slug ? ` using ${node.data.model_slug}` : '';
        const citations = node.message?.metadata?.citations || [];

        // Process the message content to replace citation markers with references
        const processedContent = processMessageContent(messageContent, citations, format);

        if (role === 'You') {
          content += `>[!question] You\n`;
        } else {
          content += `>[!note] Assistant${model}\n`;
        }
        
        content += processedContent.split('\n').map(line => `>${line}`).join('\n');
        content += '\n\n';
        
        if (timestamp) {
          content += `^[${timestamp}]\n\n`;
        }
      });

      // Add references section at the very bottom after all messages
      if (allCitations.length > 0) {
        content += '\n---\n\n>[!quote]- References\n';
        allCitations.forEach((citation, index) => {
          const metadata = citation.metadata;
          const citedText = citation.text || '';
          content += `>${index + 1}. [${metadata.title}](${metadata.url})\n>>${citedText}\n\n`;
        });
      }

      filename = `${conversationData.title || 'chatgpt-conversation'}_obsidian.md`;
      mimeType = 'text/markdown';
    } else {
      // XML format with citations
      content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      content += `<conversation title="${conversationData.title || 'ChatGPT Conversation'}" created="${new Date(conversationData.create_time * 1000).toISOString()}">\n`;
      
      // Collect all citations from all messages
      const allCitations: any[] = [];

      // First pass: collect all citations
      visibleNodes.forEach(node => {
        const citations = node.message?.metadata?.citations || [];
        allCitations.push(...citations);
      });

      // Second pass: process messages and add to content
      visibleNodes.forEach(node => {
        const role = node.data?.role === 'user' ? 'You' : (node.data?.role || 'unknown');
        const messageContent = node.data?.label || '';
        const timestamp = node.data?.timestamp ? new Date(node.data.timestamp * 1000).toISOString() : '';
        const model = node.data?.model_slug || '';

        content += `  <message role="${role}" model="${model}" timestamp="${timestamp}">\n`;
        content += `    <content><![CDATA[${messageContent}]]></content>\n`;
        content += `  </message>\n`;
      });

      // Add references section at the very bottom after all messages
      if (allCitations.length > 0) {
        content += `  <references>\n`;
        allCitations.forEach((citation, index) => {
          const metadata = citation.metadata;
          content += `    <reference id="${index + 1}">\n`;
          content += `      <title>${metadata.title}</title>\n`;
          content += `      <url>${metadata.url}</url>\n`;
          content += `      <text>${citation.text || ''}</text>\n`;
          content += `    </reference>\n`;
        });
        content += `  </references>\n`;
      }

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