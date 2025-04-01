import { useState, useRef } from 'react';
import { OpenAIConversationData, AnthropicConversation, ConversationProvider} from '../types/interfaces';
import { useNodesState, useEdgesState } from '@xyflow/react';

export function useConversationTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [conversationData, setConversationData] = useState<OpenAIConversationData | AnthropicConversation | null>(null);
  const [provider, setProvider] = useState<ConversationProvider>('openai');
  const [isLoading, setIsLoading] = useState(true);
  const [menu, setMenu] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<any>(null);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    conversationData,
    setConversationData,
    provider,
    setProvider,
    isLoading,
    setIsLoading,
    menu,
    setMenu,
    ref,
    reactFlowInstance,
    onNodesChange,
    onEdgesChange
  };
} 