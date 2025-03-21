import { useCallback, useEffect, useState } from 'react';
import { ReactFlow, addEdge, Connection, MiniMap, Controls, Background, BackgroundVariant, NodeTypes } from '@xyflow/react';
import { ContextMenu } from './ContextMenu';
import { LoadingSpinner, ErrorState } from "./LoadingStates";
import { useConversationTree } from '../hooks/useConversationTree';
import { createContextMenuHandler, checkNodes } from '../utils/conversationTreeHandlers';
import { createNodesInOrder } from '../utils/nodeCreation';
import { calculateSteps } from '../utils/nodeNavigation';
import { ExportButton } from './ExportButton';
import { CustomNode } from "./CustomNode";
import { SearchBar } from './SearchBar';
import '@xyflow/react/dist/style.css';


const nodeTypes: NodeTypes = {
    custom: CustomNode,
  };

const ConversationTree = () => {
  // Custom hook providing state and handlers for the conversation tree
  const {
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
  } = useConversationTree();

  const [showSearch, setShowSearch] = useState(false);

  // Create nodes and edges when conversation data changes
  useEffect(() => {
    if (conversationData) {
      createNodesInOrder(conversationData, checkNodes)
        .then(({ nodes: newNodes, edges: newEdges }) => {
          setNodes(newNodes as any);
          setEdges(newEdges as any);
          setIsLoading(false);
        })
        .catch(error => {
          setIsLoading(false);
          console.error("Error creating nodes:", error);
        });
    }
  }, [conversationData]);

  // Add another useEffect to handle initial data fetch
  useEffect(() => {
    handleRefresh();
  }, []);

  // Fetch conversation history from Chrome extension
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: "fetchConversationHistory" });
      if (response.success) {
        setConversationData(response.data);
        // Fit view after nodes are rendered
        setTimeout(() => {
          if (reactFlowInstance.current) {
            reactFlowInstance.current.fitView();
          }
        }, 100);
      } else {
        console.error('Failed to fetch conversation data:', response.error);
      }
    } catch (error) {
      console.error('Error in handleRefresh:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update nodes visibility by checking if they still exist in the DOM
  const updateNodesVisibility = useCallback(async () => {
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
  }, [nodes]);

  // Calculate navigation steps when a node is clicked
  const handleNodeClick = useCallback((messageId: string) => {
    setMenu(null);
    return calculateSteps(nodes, messageId);
  }, [nodes]);

  const onNodeContextMenu = useCallback(
    createContextMenuHandler(ref, setMenu),
    [ref, setMenu]
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
          onClick={onPaneClick} 
          onNodeClick={handleNodeClick} 
          onRefresh={updateNodesVisibility}
          refreshNodes={handleRefresh}
          {...menu} 
        />}
      </ReactFlow>
      {showSearch && (
        <SearchBar
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
