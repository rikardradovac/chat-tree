import { AnthropicNode, AnthropicEdge, AnthropicConversation } from '../types/interfaces';
import { nodeWidth, nodeHeight } from "../constants/constants";
import dagre from '@dagrejs/dagre';

const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));

export const createAnthropicNodesInOrder = async (
  conversationData: AnthropicConversation,
  checkNodes: (nodeIds: string[]) => Promise<boolean[]>
) => {
  const messages = conversationData.chat_messages;
  const newNodes = new Array<AnthropicNode>();
  const newEdges = new Array<AnthropicEdge>();

  // Create a map of messages for easier lookup
  // const messageMap = new Map(messages.map(msg => [msg.uuid, msg]));

  // Create nodes for each message
  messages.forEach((message, _index: number) => {
    const node: AnthropicNode = {
      id: message.uuid,
      type: 'custom',
      parent: message.parent_message_uuid || null,
      children: [],
      position: { x: 0, y: 0 }, // Will be set by dagre layout
      message: message,
      data: {
        label: message.content[0]?.text || 'No content available',
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
  const existingNodes = await checkNodes(newNodes.map(node => node.id));
  existingNodes.forEach((hidden: boolean, index: number) => {
    if (newNodes[index]) {
      newNodes[index]!.data!.hidden = hidden;
    }
  });

  return layoutNodes(newNodes, newEdges);
};

const layoutNodes = (nodes: AnthropicNode[], edges: AnthropicEdge[]) => {
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

export const calculateAnthropicSteps = (nodes: AnthropicNode[], targetId: string): string[] => {
  const steps: string[] = [];
  let currentNode = nodes.find(node => node.id === targetId);
  
  while (currentNode) {
    steps.unshift(currentNode.id);
    currentNode = nodes.find(node => node.id === currentNode?.parent);
  }
  
  return steps;
}; 