import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, addEdge, Connection, MiniMap, Controls, Background, BackgroundVariant, NodeTypes } from '@xyflow/react';
import { ContextMenu } from './ContextMenu';
import { LoadingSpinner, ErrorState } from "./LoadingStates";
import { useConversationTree } from '../hooks/useConversationTree';
import { createContextMenuHandler, checkNodes, checkNodesClaude, createClaudeContextMenuHandler } from '../utils/conversationTreeHandlers';
import { createNodesInOrder } from '../utils/nodeCreation';
import { createClaudeNodesInOrder} from '../utils/claudeNodeCreation';
import { calculateSteps } from '../utils/nodeNavigation';
import { ExportButton } from './ExportButton';
import { CopyButton } from './CopyButton';
import { CustomNode } from "./CustomNode";
import { SearchBar } from './SearchBar';
import { OpenAIConversationData, ClaudeConversation, ClaudeNode} from '../types/interfaces';
import { calculateStepsClaude } from '../utils/nodeNavigationClaude';
import '@xyflow/react/dist/style.css';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const ConversationTree = () => {
  const {
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
  } = useConversationTree();

  type FlowEdge = {
    id: string;
    source: string;
    target: string;
    type?: string;
    animated?: boolean;
    style?: any;
  };

  const typedEdges = edges as FlowEdge[];

  const [showSearch, setShowSearch] = useState(false);
  const [lastActiveChildMap, setLastActiveChildMap] = useState<Record<string, string>>({});
  const [previousPathNodeIds, setPreviousPathNodeIds] = useState<Set<string>>(new Set());

  // Create nodes and edges when conversation data changes
  useEffect(() => {
    if (conversationData) {
      chrome.runtime.sendMessage({ action: "log", message: "Starting tree initialization with provider: " + provider });
      const createNodes = provider === 'openai' 
        ? (data: OpenAIConversationData) => {
            return createNodesInOrder(data, checkNodes);
          }
        : (data: ClaudeConversation) => {
            return createClaudeNodesInOrder(data, checkNodesClaude);
          };
      
      createNodes(conversationData as any)
        .then(({ nodes: newNodes, edges: newEdges }) => {
          chrome.runtime.sendMessage({ action: "log", message: `Created ${newNodes.length} nodes and ${newEdges.length} edges` });
          setNodes(newNodes as any);
          setEdges(newEdges as any);
          setIsLoading(false);
        })
        .catch(error => {
          chrome.runtime.sendMessage({ action: "log", message: "Error creating nodes: " + error.message });
          setIsLoading(false);
          console.error("Error creating nodes:", error);
        });
    }
  }, [conversationData, provider]);

  // Add another useEffect to handle initial data fetch
  useEffect(() => {
   
    handleRefresh();
  }, []);

  // Fetch conversation history from Chrome extension
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      chrome.runtime.sendMessage({ action: "log", message: "Fetching conversation history" });
      const response = await chrome.runtime.sendMessage({ action: "fetchConversationHistory" });
      if (response.success) {
        chrome.runtime.sendMessage({ action: "log", message: "Successfully fetched conversation data" });
        // Determine the provider based on the response data structure
        const isClaude = 'chat_messages' in response.data;
        chrome.runtime.sendMessage({ action: "log", message: `Detected provider: ${isClaude ? 'claude' : 'openai'}` });
        setProvider(isClaude ? 'claude' : 'openai');
        setConversationData(response.data);
        
        // Fit view after nodes are rendered
        setTimeout(() => {
          if (reactFlowInstance.current) {
            chrome.runtime.sendMessage({ action: "log", message: "Fitting view to nodes" });
            reactFlowInstance.current.fitView();
          }
        }, 100);
      } else {
        chrome.runtime.sendMessage({ action: "log", message: "Failed to fetch conversation data: " + response.error });
        console.error('Failed to fetch conversation data:', response.error);
      }
    } catch (error) {
      chrome.runtime.sendMessage({ action: "log", message: "Error in handleRefresh: " + error });
      console.error('Error in handleRefresh:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update nodes visibility by checking if they still exist in the DOM
  const updateNodesVisibility = useCallback(async () => {
    if (provider === 'openai') {
      const nodeIds = nodes.map((node: any) => node.id);
      
      const existingNodes = await checkNodes(nodeIds);
      
      setNodes((prevNodes: any) => 
        prevNodes.map((node: any, index: number) => ({
          ...node,
          data: {
            ...node.data,
            hidden: existingNodes[index]
          }
        }))
      );
    } else {
      // Claude case
      const nodeTexts = nodes.map((node: any) => node.data.text);
      const existingNodes = await checkNodesClaude(nodeTexts);
      
      // Create a map of node IDs to their parents for efficient lookup
      const parentMap: Record<string, string> = {};
      edges.forEach((edge: any) => {
        parentMap[edge.target] = edge.source;
      });

      // Create a map of node IDs to their visibility status
      const visibilityMap: Record<string, boolean> = {};
      nodes.forEach((node: any, index: number) => {
        visibilityMap[node.id] = !existingNodes[index];
      });

      setNodes((prevNodes: any) => 
        prevNodes.map((node: any, index: number) => {
          const isHidden = existingNodes[index];
          const wasOnPreviousPath = previousPathNodeIds.has(node.id);
          
          let isPreviouslyVisited = false;
          if (wasOnPreviousPath && isHidden) {
            // Check if parent is hidden - if parent is visible, we're on a new branch
            const parentId = parentMap[node.id];
            if (!parentId || visibilityMap[parentId]) {
              // No parent (root) or parent is visible - we're on a new branch
              isPreviouslyVisited = false;
            } else {
              // Parent is hidden - maintain previously visited state
              isPreviouslyVisited = true;
            }
          }

          return {
            ...node,
            data: {
              ...node.data,
              hidden: isHidden,
              previouslyVisited: isPreviouslyVisited
            }
          };
        })
      );
    }
  }, [nodes, provider, edges, previousPathNodeIds]);

  // Calculate navigation steps when a node is clicked
  const handleNodeClick = useCallback((messageId: string) => {
    setMenu(null);
    
    if (provider === 'openai') {
      return calculateSteps(nodes, messageId);
    } else {
      
      // Find the parent of the clicked node
      const parentEdge = typedEdges.find(edge => edge.target === messageId);
      if (parentEdge) {
        const parentId = parentEdge.source;
          
        // Update the lastActiveChildMap with this new active child
        setLastActiveChildMap(prev => {
          const updated = { ...prev, [parentId]: messageId };
          
          return updated;
        });
      }

      // For Claude, store the currently visible nodes before navigation
      const currentlyVisibleNodes = new Set(
        nodes
          .filter((node: any) => !node.data.hidden)
          .map((node: any) => node.id)
      );
      setPreviousPathNodeIds(currentlyVisibleNodes);

      // Calculate and execute navigation steps
      const steps = calculateStepsClaude(nodes as ClaudeNode[], messageId, lastActiveChildMap);
      
      // After navigation completes, update visibility states
      setTimeout(async () => {
        await updateNodesVisibility();
      }, 100); // Small delay to ensure DOM updates have completed

      return steps;
    }
  }, [nodes, provider, lastActiveChildMap, typedEdges, updateNodesVisibility]);

  useEffect(() => {
    const messageListener = (message: any, _sender: chrome.runtime.MessageSender, _sendResponse: (response?: any) => void) => {
      if (message.action === "updateLastActiveChild" && message.parentId && message.activeChildId) {
        
        setLastActiveChildMap(prevMap => {
          const updated = { ...prevMap, [message.parentId]: message.activeChildId };
         
          return updated;
        });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: any) => {
      if (provider === 'openai') {
        createContextMenuHandler(ref, setMenu)(event, node);
      } else {
        createClaudeContextMenuHandler(ref, setMenu, nodes)(event, node);
      }
    },
    [ref, setMenu, provider, nodes]
  );

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Add keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoading) return <LoadingSpinner />;
  if (!conversationData) return <ErrorState />;

  return (
    <div className="w-full h-full" style={{ height: '100%', width: '100%' }}>
      <div className="absolute top-4 right-4 flex items-center bg-white rounded-lg shadow-lg divide-x divide-gray-200 z-10">
        <button
          onClick={() => setShowSearch(true)}
          className="p-2.5 hover:bg-gray-50 transition-colors rounded-l-lg group"
          title="Search messages (⌘+K)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 group-hover:text-gray-800" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={handleRefresh}
          className="p-2.5 hover:bg-gray-50 transition-colors group"
          title="Refresh conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600 group-hover:text-gray-800" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </button>
        <CopyButton 
          nodes={nodes} 
          onNodeClick={handleNodeClick}
          provider={provider}
        />
        <ExportButton 
          nodes={nodes} 
          conversationData={conversationData}
          className="p-2.5 hover:bg-gray-50 transition-colors rounded-r-lg group"
        />
      </div>
      <ReactFlow
        ref={ref}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onInit={instance => { 
          reactFlowInstance.current = instance;
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Controls className="bg-white rounded-lg shadow-lg" />
        <MiniMap 
          nodeColor={(node) => node.data?.role === 'user' ? '#fefce8' : '#f9fafb'}
          className="bg-white rounded-lg shadow-lg"
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#f1f1f1" />
        {menu && <ContextMenu 
          provider={provider}
          onClick={onPaneClick} 
          onNodeClick={handleNodeClick} 
          onRefresh={updateNodesVisibility}
          refreshNodes={handleRefresh}
          {...menu} 
        />}
      </ReactFlow>
      {showSearch && (
        <SearchBar
          provider={provider}
          nodes={nodes}
          onNodeClick={handleNodeClick}
          onClose={() => setShowSearch(false)}
          onRefresh={updateNodesVisibility}
        />
      )}
    </div>
  );
};

export default ConversationTree;
