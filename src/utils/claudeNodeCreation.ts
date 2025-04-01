import { ClaudeNode, ClaudeEdge, ClaudeConversation } from '../types/interfaces';
import { nodeWidth, nodeHeight } from "../constants/constants";
import dagre from '@dagrejs/dagre';

const dagreGraph = new dagre.graphlib.Graph().setGraph({}).setDefaultEdgeLabel(() => ({}));

export const createClaudeNodesInOrder = async (
  conversationData: ClaudeConversation,
  checkNodes: (nodeTexts: string[]) => Promise<boolean[]>
) => {
  chrome.runtime.sendMessage({ action: "log", message: "Starting Claude node creation" });
  const messages = conversationData.chat_messages;
  const newNodes = new Array<ClaudeNode>();
  const newEdges = new Array<ClaudeEdge>();

  // Create nodes for each message
  messages.forEach((message, _index: number) => {
    chrome.runtime.sendMessage({ action: "log", message: `Creating node for message ${message.uuid}` });
    const node: ClaudeNode = {
      id: message.uuid,
      type: 'custom',
      parent: message.parent_message_uuid || null,
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
        chrome.runtime.sendMessage({ action: "log", message: `Added child relationship: ${message.parent_message_uuid} -> ${message.uuid}` });
      }
    }

    newNodes.push(node);
  });

  // Create edges between parent and child nodes
  newNodes.forEach(node => {
    if (node.parent) {
      chrome.runtime.sendMessage({ action: "log", message: `Creating edge: ${node.parent} -> ${node.id}` });
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
  chrome.runtime.sendMessage({ action: "log", message: "Checking node visibility states" });
  const existingNodes = await checkNodes(newNodes.map(node => node.data.text));
  existingNodes.forEach((hidden: boolean, index: number) => {
    if (newNodes[index]) {
      newNodes[index]!.data!.hidden = hidden;
    }
  });

  chrome.runtime.sendMessage({ action: "log", message: "Starting node layout" });
  return layoutNodes(newNodes, newEdges);
};

const layoutNodes = (nodes: ClaudeNode[], edges: ClaudeEdge[]) => {
  chrome.runtime.sendMessage({ action: "log", message: `Layouting ${nodes.length} nodes and ${edges.length} edges` });
  
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

  chrome.runtime.sendMessage({ action: "log", message: "Node layout completed" });
  return { nodes: nodesWithPositions, edges };
};
