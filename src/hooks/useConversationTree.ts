import { useState, useRef } from 'react';
import { OpenAIConversationData, OpenAIMenuState } from '../types/interfaces';
import { useNodesState, useEdgesState } from '@xyflow/react';

export function useConversationTree() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [conversationData, setConversationData] = useState<OpenAIConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menu, setMenu] = useState<OpenAIMenuState>(null);
  const ref = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<any>(null);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    conversationData,
    setConversationData,
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