import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';

interface Author {
    role: string;
    name: string | null;
    metadata: Record<string, any>;
}

interface Content {
    content_type: string;
    model_set_context?: string | null; // Make this optional
    repository?: string | null;         // Make this optional
    repo_summary?: string | null;       // Make this optional
    parts?: string[] | null;
}

interface Message {
    id: string;
    author: Author;
    create_time: number | null;
    update_time: number | null;
    content: Content;
    status: string;
    end_turn: boolean | null;
    weight: number;
    metadata: Record<string, any>;
    recipient: string;
    channel: string | null;
}

interface Node {
    position?: { x: number; y: number };
    id: string;
    data?: { label: string };
    message: Message | null;
    parent: string | null;
    children: string[];
}

interface Edge {
    id: string;
    source: string;
    target: string;
    type: string;
}

interface Mapping {
    [key: string]: Node;
}

interface ConversationData {
    title: string;
    create_time: number;
    update_time: number;
    mapping: Mapping;
    moderation_results: any[];
    current_node: string;
    plugin_ids: string | null;
    conversation_id: string;
    conversation_template_id: string | null;
    gizmo_id: string | null;
    is_archived: boolean;
    safe_urls: string[];
    default_model_slug: string;
    conversation_origin: string | null;
    voice: string | null;
    async_status: string | null;
}


const ConversationTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  const createNodesInOrder = (conversationData: ConversationData) => {
    const mapping = conversationData.mapping;
    const newNodes = new Set<Node>();
    const newEdges = new Set<Edge>();
    const nodePositions = new Map<string, {x: number, y: number}>();
    
    // Find the first meaningful nodes (nodes with content)
    const findFirstContentNodes = () => {
      const rootId = Object.keys(mapping).find(id => !mapping[id].message && !mapping[id].parent);
      if (!rootId || !mapping[rootId].children) return [];
      
      const contentNodes: string[] = [];
      const processNode = (nodeId: string) => {
        const node = mapping[nodeId];
        
        // If this node has content and is not system/tool, add it to our list
        if (node.message?.content?.parts?.[0] && 
            node.message.author.role !== 'system' && 
            node.message.author.role !== 'tool') {
          contentNodes.push(nodeId);
          return;
        }
        
        // Otherwise, continue through children
        if (node.children) {
          node.children.forEach(childId => processNode(childId));
        }
      };
      
      mapping[rootId].children.forEach(childId => processNode(childId));
      return contentNodes;
    };

    // Get the first parent with content
    const getContentParent = (nodeId: string): string | null => {
      const node = mapping[nodeId];
      if (!node.parent) return null;
      
      const parent = mapping[node.parent];
      if (parent.message?.content?.parts?.[0] && 
          parent.message.author.role !== 'system' && 
          parent.message.author.role !== 'tool') {
        return node.parent;
      }
      return getContentParent(node.parent);
    };

    // Calculate positions for a node and all its descendants
    const calculatePositions = (nodeId: string, xOffset: number, level = 0) => {
      const node = mapping[nodeId];
      
      // Skip nodes without content or system/tool nodes
      if (!node.message?.content?.parts?.[0] || 
          node.message.author.role === 'system' || 
          node.message.author.role === 'tool') {
        return;
      }

      // Set position for current node
      const position = {
        x: xOffset,
        y: level * 150
      };
      nodePositions.set(nodeId, position);

      // Process children, skipping intermediate nodes
      if (node.children) {
        node.children.forEach(childId => {
          const childNode = mapping[childId];
          if (childNode.message?.content?.parts?.[0] && 
              childNode.message.author.role !== 'system' && 
              childNode.message.author.role !== 'tool' &&
              childNode.message.recipient === 'all') {
            calculatePositions(childId, xOffset, level + 1);
          } else if (childNode.children) {
            // If this is an intermediate node, process its children
            childNode.children.forEach(grandChildId => {
              calculatePositions(grandChildId, xOffset, level + 1);
            });
          }
        });
      }
    };

    // Start position calculation from first content nodes
    const firstContentNodes = findFirstContentNodes();
    firstContentNodes.forEach((nodeId, index) => {
      calculatePositions(nodeId, index * 300);
    });

    // Create nodes and edges
    Object.keys(mapping).forEach(nodeId => {
      const node = mapping[nodeId];
      
      // Skip nodes without content or system/tool nodes
      if (!node.message?.content?.parts?.[0] || 
          node.message.author.role === 'system' || 
          node.message.author.role === 'tool') {
        return;
      }

      const position = nodePositions.get(nodeId);
      if (!position) return;

      const role = node.message.author.role;
      const content = node.message.content.parts[0].substring(0, 50) + "...";
      
      newNodes.add({
        ...node,
        position,
        data: {
          label: `[${role}] ${content}`
        }
      });

      // Create edge to content parent
      const contentParent = getContentParent(nodeId);
      if (contentParent) {
        newEdges.add({
          id: `${contentParent}-${nodeId}`,
          source: contentParent,
          target: nodeId,
          type: 'smoothstep',
        });
      }
    });

    setNodes(Array.from(newNodes) as any);
    setEdges(Array.from(newEdges) as any);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ action: "fetchConversationHistory" });
        if (response.success) {
          setConversationData(response.data);
        } else {
          console.error('Failed to fetch conversation data:', response.error);
        }
      } catch (error) {
        console.error('Error fetching conversation data:', error);
      } finally {
        setIsLoading(false);
      }
    // setIsLoading(false);
    // setConversationData(fakeData);
    };

    fetchData();
  }, []);

  // Create nodes when conversation data is available
  useEffect(() => {
    if (conversationData) {
      createNodesInOrder(conversationData);
    }
  }, [conversationData]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  if (isLoading) {
    return <div>Loading conversation...</div>;
  }

  if (!conversationData) {
    return <div>No conversation data available</div>;
  }
 
  return (
    <div className="w-full h-full" style={{ height: '90vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView // Add this to automatically fit the view to the graph
        >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export default ConversationTree;

