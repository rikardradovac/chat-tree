import { useCallback, useEffect, useState, useRef } from 'react';
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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ContextMenu from './context-menu';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';

interface Author {
    role: string;
    name: string | null;
    metadata: Record<string, any>;
}

interface Content {
    content_type: string;
    model_set_context?: string | null; 
    repository?: string | null;        
    repo_summary?: string | null;       
    parts?: string[] | null;
}

interface MetaData {
    is_visually_hidden_from_conversation?: boolean | null;
    serialization_metadata?: Record<string, any> | null;
    request_id?: string | null;
    message_source?: string | null;
    timestamp_?: string | null;
    message_type?: string | null;
    model_slug?: string | null;
    default_model_slug?: string | null;
    parent_id?: string | null;
    model_switcher_deny?: string[];
    finish_details?: Record<string, any> | null;
    is_complete?: boolean | null;
    citations?: string[];
    content_references?: string[];
    gizmo_id?: string | null;
    kwargs?: Record<string, any> | null;
    

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
    metadata: MetaData;
    recipient: string;
    channel: string | null;
}

interface Node {
    position?: { x: number; y: number };
    id: string;
    data?: { label: string; role?: string; timestamp?: number, id?: string, hidden?: boolean, contentType?: string};
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

type MenuState = {
    messageId: string;
    childrenIds: string[];
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
    hidden?: boolean;
  } | null;




const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));
const nodeWidth = 300;
const nodeHeight = 120;


  // const log = (message: any) => {
  //   // Log to background console
  //   chrome.runtime.sendMessage({ 
  //       action: 'log', 
  //       message: message 
  //   });
  //   // Also log to regular console
  //   console.log('[ChatTree]', message);
  // };

const CustomNode = ({ data }: { data: any }) => {   
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div 
        className={`px-4 py-2 shadow-lg rounded-lg border transition-all duration-300 
          ${data.role === 'user' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}
          ${data.hidden ? 'grayscale' : ''}
          ${isExpanded ? 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[80vw] h-[80vh]' : ''}
        `} 
        style={{
          width: isExpanded ? undefined : nodeWidth,
          height: isExpanded ? undefined : nodeHeight,
          position: isExpanded ? 'fixed' : 'relative',
          opacity: data.hidden && !isExpanded ? 0.4 : 1,
          background: data.hidden && !isExpanded ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)' : undefined
        }}
        onDoubleClick={() => setIsExpanded(!isExpanded)}
      >
        {!isExpanded && <Handle type="target" position={Position.Top} className="w-2 h-2" />}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              data.role === 'user' ? 'bg-yellow-400' : 'bg-gray-400'
            }`} />
            <div className="text-xs font-semibold text-gray-500 uppercase">
              {data.role}
            </div>
          </div>
          {data.contentType === 'multimodal_text' && (
            <div>
              <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="20" height="20" viewBox="0 0 26 26">
              <path d="M 20.265625 4.207031 C 20.023438 3.96875 19.773438 3.722656 19.527344 3.476563 C 19.277344 3.230469 19.035156 2.980469 18.792969 2.734375 C 17.082031 0.988281 16.0625 0 15 0 L 7 0 C 4.796875 0 3 1.796875 3 4 L 3 22 C 3 24.203125 4.796875 26 7 26 L 19 26 C 21.203125 26 23 24.203125 23 22 L 23 8 C 23 6.9375 22.011719 5.917969 20.265625 4.207031 Z M 21 22 C 21 23.105469 20.105469 24 19 24 L 7 24 C 5.894531 24 5 23.105469 5 22 L 5 4 C 5 2.894531 5.894531 2 7 2 L 14.289063 1.996094 C 15.011719 2.179688 15 3.066406 15 3.953125 L 15 7 C 15 7.550781 15.449219 8 16 8 L 19 8 C 19.996094 8 21 8.003906 21 9 Z"></path>
              </svg>
            </div>
          )}
        </div>

        <div className={`mt-2 text-sm text-gray-700 ${
          isExpanded  
            ? 'h-[calc(100%-100px)] overflow-y-auto nowheel' 
            : 'line-clamp-3'
          }`} 
          style={{ 
            wordBreak: 'break-word',
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.label}</ReactMarkdown>
        </div>

        {data.timestamp && (
          <div className="absolute bottom-2 left-4 text-xs text-gray-400">
            {new Date(parseFloat(data.timestamp) * 1000).toLocaleString()} 
          </div>
        )}
        
        {!isExpanded && <Handle type="source" position={Position.Bottom} className="w-2 h-2" />}

        {isExpanded && (
          <button 
            className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full"
            onClick={() => setIsExpanded(false)}
          >
            ✕
          </button>
        )}
      </div>

      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 -z-10"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  );
};

const nodeTypes: NodeTypes = {
    custom: CustomNode,
  };





const ConversationTree = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [conversationData, setConversationData] = useState<ConversationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menu, setMenu] = useState<MenuState>(null);
  const ref = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<any>(null);


  const checkNodes = async (nodeIds: string[]) => {
        // check if the nodes are in the DOM (to see which are currently visible to the user)
        const response = await chrome.runtime.sendMessage({
        action: "checkNodes",
        nodeIds: nodeIds 
        });
        
        if (response.success) {
        return response.existingNodes;
        } else {
        console.error('Error checking nodes:', response.error);
            throw new Error(response.error);
        }
    };

  const createNodesInOrder = async (conversationData: ConversationData) => {
    const mapping = conversationData.mapping;
    const newNodes = new Array<Node>();
    const newEdges = new Array<Edge>();

    const findFirstContentParent = (node: Node): Node | null => {
        // Use a queue to store nodes to process
        const queue: Node[] = [...node.children.map(childId => mapping[childId])];
        
        while (queue.length > 0) {
            const currentNode = queue.shift()!;
            
            // If the current node has content and is a user message, we have found the first content parent
            if (currentNode.message?.content?.parts?.[0] && 
                currentNode.message.author.role === "user") {
                let tempParent = mapping[currentNode.parent!];
                
                // For each child of the temp parent
                tempParent.children.forEach((childId, index) => {
                    let currentChild = mapping[childId];
                    
                    // Keep traversing down until we find a valid node
                    while (currentChild && !(currentChild.message?.content?.parts?.[0] && 
                           currentChild.message.author.role !== 'system' && 
                           currentChild.message.author.role !== 'tool' &&
                           currentChild.message.recipient === 'all')) {
                        // If current child is invalid and has children, move to its first child
                        if (currentChild.children.length > 0) {
                            currentChild = mapping[currentChild.children[0]];
                        } else {
                            break;
                        }
                    }
                    
                    // If we found a valid child, update the temp parent's children array
                    if (currentChild) {
                        tempParent.children[index] = currentChild.id;
                        currentChild.parent = tempParent.id;
                    }
                });
                
                return tempParent;
            }
            
            // Add children to the queue
            queue.push(...currentNode.children.map(childId => mapping[childId]));
        }
        
        return null;
    };

    const createChildNodes = (node: Node) => {
      if (node.children.length === 0) return;
    
      // Helper function to find the first valid descendant
      const findFirstValidDescendant = (currentNode: Node): Node | null => {
        // If current node is valid, return it
        if (currentNode.message?.content?.parts?.[0] &&
            currentNode.message.author.role !== 'system' && 
            currentNode.message.author.role !== 'tool' &&
            currentNode.message.recipient === 'all') {
          return currentNode;
        }
    
        // Otherwise, check children recursively
        for (const childId of currentNode.children) {
          const validDescendant = findFirstValidDescendant(mapping[childId]);
          if (validDescendant) return validDescendant;
        }
    
        return null;
      };
    
      // Process each child, potentially skipping invalid intermediates
      const validChildren = node.children
        .map(childId => findFirstValidDescendant(mapping[childId]))
        .filter((child): child is Node => child !== null);
    
      // Update the node's children array to point directly to valid descendants
      node.children = validChildren.map(child => child.id);
    
      // Process each valid child
      validChildren.forEach(child => {
        child.parent = node.id;
        child.type = 'custom';
        const role = child.message!.author.role;

        // if the content typ is not 'text', find the string in the content list
        let content: string = ""
        if (child.message!.content.content_type !== 'text') {
          content = child.message!.content.parts!.find(part => typeof part === 'string') ?? 'No text provided';
        } else {
          content = child.message!.content.parts![0];
        }
        child.data = {
          label: content,
          role: role,
          timestamp: child.message!.create_time ?? undefined,
          id: child.id,
          hidden: true, // default to hidden
          contentType: child.message!.content.content_type
        };
        
        newNodes.push(child);
        newEdges.push({
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#000000', strokeWidth: 2 }
        });
    
        // Recursively process the valid child's children
        createChildNodes(child);
      });
    };

    let rootNode = Object.values(mapping).find(node => !node.parent) as Node | null;
    if (!rootNode) return;


    rootNode = findFirstContentParent(rootNode);
    if (!rootNode) return;
    rootNode.type = 'custom';
    const role = rootNode.message!.author.role;
    const content = role !== 'system' ? rootNode.message!.content.parts![0] : 'Start of your conversation';
    rootNode.data = {
      label: content,
      role: role,
      timestamp: rootNode.message?.create_time ?? undefined
    };
    
    newNodes.push(rootNode);
    createChildNodes(rootNode);
    
    const existingNodes = await checkNodes(newNodes.map(node => node.id));
    existingNodes.forEach((hidden: boolean, index: number) => {
        if (newNodes[index]) {
            newNodes[index]!.data!.hidden = hidden;
        }
    });
    
    newNodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    newEdges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

    dagre.layout(dagreGraph);
     
      const newNodesWithPositions = newNodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const newNode = {
          ...node,
          targetPosition: 'top',
          sourcePosition: 'bottom',
          // We are shifting the dagre node position (anchor=center center) to the top left
          // so it matches the React Flow node anchor point (top left).
          position: {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
          },
        };
     
        return newNode;
      });
     
    setNodes(newNodesWithPositions as any);
    setEdges(newEdges as any);
  };

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ action: "fetchConversationHistory" });
      if (response.success) {
        setConversationData(response.data);
        // After the nodes are updated, fit the view
        setTimeout(() => {
          reactFlowInstance.current?.fitView();
        }, 100);
      } else {
        console.error('Failed to fetch conversation data:', response.error);
      }
    } catch (error) {
      console.error('Error fetching conversation data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    handleRefresh();
  }, [handleRefresh]);

  useEffect(() => {
    if (conversationData) {
        
      createNodesInOrder(conversationData).then().catch();
    }
  }, [conversationData]);

  




  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      const pane = ref?.current?.getBoundingClientRect();
      const nodeId = node.data?.id ?? '';
      if (pane) {
        setMenu({
          messageId: nodeId,
          childrenIds: node.children,
          role: node.data?.role ?? '',
          top: event.clientY < pane.height - 200 && event.clientY ? event.clientY - 48 : false,
          left: event.clientX < pane.width - 200 && event.clientX ? event.clientX : false,
          right: event.clientX >= pane.width - 200 && pane.width - event.clientX,
          bottom:
            event.clientY >= pane.height - 200 && pane.height - event.clientY + 48,
          hidden: node.data?.hidden
        });
      } 
    },
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);

    // update the visibility of the nodes based on the DOM
    const updateNodesVisibility = useCallback(async () => {
        const nodeIds = nodes.map((node: Node) => node.id);
        const existingNodes = await checkNodes(nodeIds);
        
        setNodes((prevNodes: any) => 
            prevNodes.map((node: Node, index: number) => ({
                ...node,
                data: {
                    ...node.data,
                    hidden: existingNodes[index]
                }
            }))
        );
    }, [nodes]);


  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const calculateSteps = useCallback((targetId: string) => {
    // create an array of steps for the background script to execute. This will be the order of clicks on
    // the different chat nodes to get to the target branch
    // Traverse up the tree until we find a visible node and record the steps, return the reversed order
    const stepsToTake: Array<{
      nodeId: string;
      stepsLeft: number;
      stepsRight: number;
    }> = [];

    let currentNode: any = nodes.find((node: Node) => node.id === targetId);
      
    if (!currentNode) return [];
    // search for the parent of the target node until we find a visible node
    while (currentNode?.data?.hidden) {
      const parent: any = nodes.find((n: Node) => n.id === currentNode?.parent);
      if (!parent) break;

      const childIndex = parent.children.indexOf(currentNode.id);
      const activeChildIndex = parent.children.findIndex(
        (childId: any) => (nodes as any).find((node: any) => node.id === childId)?.data?.hidden === false
      );
    
      // if the parent has more than one child, we need to find the index of the first visible child
      if (parent.children.length > 1) {
        // the case when the selected node is far down in hidden branch
        if (activeChildIndex === -1) {
          for (let i = 0; i < childIndex; i++) {
            stepsToTake.push({
              nodeId: parent.children[0],
              stepsLeft: -1,
              stepsRight: 1,
            });
          }
        } else {
            // if the wanted index is greater than the active index, we need to move right
          const moveRight = childIndex > activeChildIndex;
          const steps = Math.abs(activeChildIndex - childIndex);

          for (let i = 0; i < steps; i++) {
            stepsToTake.push({
              nodeId: parent.children[activeChildIndex],
              stepsLeft: moveRight ? -1 : 1,
              stepsRight: moveRight ? 1 : -1,
            });
          }
        }
      }
      currentNode = parent;
    }

    stepsToTake.reverse();
  
    return stepsToTake;
  }, [nodes]);

  const handleNodeClick = useCallback((messageId: string) => {
    setMenu(null); // Close the context menu after clicking
    return calculateSteps(messageId);

  }, [calculateSteps]);

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
        No chat found, please refresh the web page and try again!
      </div>
    );
  }
 
  return (
    <div className="w-full h-full" style={{ height: '100%', width: '100%' }}>
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={handleRefresh}
          className="bg-white p-2 rounded-full shadow-lg mt-2 hover:bg-gray-50 transition-colors"
          title="Refresh conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
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
        onInit={instance => { reactFlowInstance.current = instance; }}
        fitView
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
          {...menu} 
        />}
      </ReactFlow>
    </div>
  );
}

export default ConversationTree;
