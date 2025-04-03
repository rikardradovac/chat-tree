import { ClaudeNode, ClaudeEdge, ClaudeConversation } from '../types/interfaces';
import { nodeWidth, nodeHeight } from "../constants/constants";
import dagre from '@dagrejs/dagre';

const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));

export const createClaudeNodesInOrder = async (
  conversationData: ClaudeConversation,
  checkNodes: (nodeTexts: string[]) => Promise<boolean[]>
) => {
  const messages = conversationData.chat_messages;
  const newNodes = new Array<ClaudeNode>();
  const newEdges = new Array<ClaudeEdge>();

  // Create root node
  const rootNode: ClaudeNode = {
    id: 'root',
    type: 'custom',
    parent: null,
    children: [],
    position: { x: 0, y: 0 },
    message: null,
    data: {
      label: 'Start of your conversation',
      text: 'Start of your conversation',
      role: 'system',
      timestamp: new Date().getTime(),
      id: 'root',
      hidden: true,
      contentType: 'text'
    }
  };
  newNodes.push(rootNode);

  // Create nodes for each message
  messages.forEach((message, _index: number) => {
    message.parent_message_uuid = message.parent_message_uuid === '00000000-0000-4000-8000-000000000000' ? 'root' : message.parent_message_uuid;
    const node: ClaudeNode = {
      id: message.uuid,
      type: 'custom',
      parent: message.parent_message_uuid, // Connect to root if no parent
      children: [],
      position: { x: 0, y: 0 }, // Will be set by dagre layout
      message: message,
      data: {
        label: message.content[0]?.text || 'No content available',
        text: message.content[0]?.text || 'No content available',
        role: message.sender,
        timestamp: new Date(message.created_at).getTime(),
        id: message.uuid,
        hidden: true,
        contentType: message.content[0]?.type || 'text'
      }
    };

    // Add child relationships
    if (message.parent_message_uuid) {
      const parentNode = newNodes.find(n => n.id === message.parent_message_uuid);
      if (parentNode) {
        parentNode.children.push(message.uuid);
        
      }
    } else {
      // If no parent, connect to root node
      rootNode.children.push(message.uuid);

    }

    newNodes.push(node);
  });



  // Create edges between parent and child nodes
  newNodes.forEach(node => {
    if (node.parent) {
    
      newEdges.push({
        id: `${node.parent}-${node.id}`,
        source: node.parent,
        target: node.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#000000', strokeWidth: 2 }
      });
    }
  });

  // Update visibility state of nodes
  const nodesToCheck = newNodes.filter(node => node.id !== 'root'); // Don't check root node
  const existingNodes = await checkNodes(nodesToCheck.map(node => node.data.text));
  existingNodes.forEach((hidden: boolean, index: number) => {
    if (nodesToCheck[index]) {
      nodesToCheck[index]!.data!.hidden = hidden;
    }
  });

  return layoutNodes(newNodes, newEdges);
};

const layoutNodes = (nodes: ClaudeNode[], edges: ClaudeEdge[]) => {
  
  // Initialize dagre graph with node dimensions
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Apply dagre layout algorithm
  dagre.layout(dagreGraph);

  // Transform nodes with calculated positions
  const nodesWithPositions = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: nodesWithPositions, edges };
};
