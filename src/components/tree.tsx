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
  Handle,
  Position,
  NodeTypes,
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
    data?: { label: string; role?: string; timestamp?: number };
    message: Message | null;
    parent: string | null;
    children: string[];
    type?: string;
}

interface Edge {
    id: string;
    source: string;
    target: string;
    type: string;
    animated?: boolean;
    style?: any;
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

const CustomNode = ({ data }: { data: any }) => {
  return (
    <div className={`px-4 py-2 shadow-lg rounded-lg border ${
      data.role === 'user' ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
    }`} style={{
      width: '300px',
      height: '120px',
      position: 'relative'
    }}>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <div className="flex items-center">
        <div className={`w-2 h-2 rounded-full mr-2 ${
          data.role === 'user' ? 'bg-blue-400' : 'bg-purple-400'
        }`} />
        <div className="text-xs font-semibold text-gray-500 uppercase">
          {data.role}
          
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-700" style={{ 
        wordBreak: 'break-word',
        height: '70px',
        overflowY: 'auto'
      }}>
        {data.label.length > 100 ? `${data.label.substring(0, 100)}...` : data.label}
      </div>
      {data.timestamp && (
        <div className="absolute bottom-2 left-4 text-xs text-gray-400">
          {new Date(data.timestamp).toLocaleString()}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </div>
  );
};

const nodeXSpacing = 650;
const nodeYSpacing = 200;

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

const ConversationTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const createNodesInOrder = (conversationData: ConversationData) => {
    const mapping = conversationData.mapping;
    const newNodes = new Array<Node>();
    const newEdges = new Array<Edge>();
    
    // Keep track of used positions to prevent overlapping
    const usedPositions = new Set<string>();
    
    // Helper to find next available position
    const findAvailablePosition = (baseX: number, baseY: number, scale: number): { x: number, y: number} => {
      let x = baseX;
      let y = baseY;
      
      // Keep trying positions until we find an unused one
      while (usedPositions.has(`${Math.round(x)},${Math.round(y)}`)) {
        x += nodeXSpacing * scale;
      }
      
      usedPositions.add(`${Math.round(x)},${Math.round(y)}`);
      return { x, y };
    };

    const findFirstContentParent = (node: Node): Node | null => {
        // If no children, return null
        if (node.children.length === 0) return null;

        for (const childId of node.children) {
            const child = mapping[childId];
            
            // If the child has content and is a user message, return it
            if (child.message?.content?.parts?.[0] && child.message.author.role === "user") {
                return child;
            }

            // If the child has content, search for it in its children
            const foundInChild = findFirstContentParent(child);
            if (foundInChild && foundInChild.parent) {
                // Return the parent of the child that has content so we can use it as the root
                return mapping[foundInChild.parent];
            }
        }
        
        return null;
    }

    const createChildNodes = (node: Node, baseX = 0, yPos = 0, scale = 1) => {
      // the scale is used to place the parent node in the middle of its children and to not push the children too far apart
      if (node.children.length === 0) return;

      baseX = baseX - (nodeXSpacing * scale * (node.children.length - 1)) / 2;

      node.children.forEach((childId) => {
        const child = mapping[childId];
        
        // Check if current child node is valid
        if (child.message?.content?.parts?.[0] &&
            child.message.author.role !== 'system' && 
            child.message.author.role !== 'tool' &&
            child.message.recipient === 'all') {
        
          const position = findAvailablePosition(
            baseX,
            yPos,
            scale
          );
          
          child.parent = node.id;
          child.position = position;
          child.type = 'custom';
          const role = child.message.author.role;
          const content = child.message.content.parts[0];
          child.data = {
            label: content,
            role: role,
            timestamp: child.message.create_time ?? undefined
          };
          
          newNodes.push(child);
          newEdges.push({
            id: `${node.id}-${child.id}`,
            source: node.id,
            target: child.id,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#2196f3', strokeWidth: 2 }
          });
          
          createChildNodes(child, position.x, yPos + nodeYSpacing);
        } else {
          
          child.children.forEach((grandChildId) => {
            const grandChild = mapping[grandChildId];
            const processDescendant = (descendant: Node) => {
                // if the descendant is valid
              if (descendant.message?.content?.parts?.[0] && 
                  descendant.message.author.role !== 'system' && 
                  descendant.message.author.role !== 'tool' &&
                  descendant.message.recipient === 'all') {
                
                const position = findAvailablePosition(
                  baseX,
                  yPos,
                  scale
                );
                
                descendant.parent = node.id;
                descendant.position = position;
                descendant.type = 'custom';
                const role = descendant.message.author.role;
                const content = descendant.message.content.parts[0];
                descendant.data = {
                  label: content,
                  role: role,
                  timestamp: descendant.message.create_time ?? undefined
                };
                
                newNodes.push(descendant);
                newEdges.push({
                  id: `${node.id}-${descendant.id}`,
                  source: node.id,
                  target: descendant.id,
                  type: 'smoothstep',
                  animated: true,
                  style: { stroke: '#2196f3', strokeWidth: 2 }
                });

                  createChildNodes(descendant, position.x, yPos + nodeYSpacing, 0.5);
                
              } else {
                descendant.children.forEach((descId) => {
                  processDescendant(mapping[descId]);
                });
              }
            };
            processDescendant(grandChild);
          });
        }
      });
    };

    // Root node positioning
    let rootNode = Object.values(mapping).find(node => !node.parent) as Node | null;
    if (!rootNode) return;

    rootNode = findFirstContentParent(rootNode);
    if (!rootNode) return;

    const rootPosition = { x: window.innerWidth / 2, y: 50 };
    usedPositions.add(`${Math.round(rootPosition.x)},${Math.round(rootPosition.y)}`);
    rootNode.position = rootPosition;
    
    rootNode.type = 'custom';
    const role = rootNode.message!.author.role;
    const content = role !== 'system' ? rootNode.message!.content.parts![0] : 'Start of your conversation';
    rootNode.data = {
      label: content,
      role: role,
      timestamp: rootNode.message?.create_time ?? undefined
    };
    
    newNodes.push(rootNode);
    createChildNodes(rootNode, rootPosition.x , rootPosition.y + nodeYSpacing);

    setNodes(newNodes as any);
    setEdges(newEdges as any);
  };

  useEffect(() => {
    const fetchData = async () => {
        // fetch data using chrome extension api
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
    };
    
    fetchData();
  }, []);

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
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!conversationData) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        No conversation data available
      </div>
    );
  }
 
  return (
    <div className="w-full h-full" style={{ height: '90vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Controls className="bg-white rounded-lg shadow-lg" />
        <MiniMap 
          nodeColor={(node) => {
            return node.data?.role === 'user' ? '#bbdefb' : '#e1bee7';
          }}
          className="bg-white rounded-lg shadow-lg"
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#f1f1f1" />
      </ReactFlow>
    </div>
  );
}

export default ConversationTree;
