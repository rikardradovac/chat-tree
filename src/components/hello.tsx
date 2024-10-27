import React, { useCallback, useEffect } from 'react';
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



const ConversationTree = ({ conversationData }: { conversationData: ConversationData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const createNodesInOrder = (conversationData: ConversationData) => {
    const mapping = conversationData.mapping;
    const newNodes = new Set<Node>();
    const newEdges = new Set<Edge>();
    const nodePositions = new Map<string, {x: number, y: number}>();
    
    // Find the first meaningful nodes (user messages) after system messages
    const findFirstUserNodes = () => {
      // Start from the root node (the one with null message)
      const rootId = Object.keys(mapping).find(id => !mapping[id].message && !mapping[id].parent);
      if (!rootId || !mapping[rootId].children) return [];
      
      // Get all paths through system messages to first user/assistant messages
      const userNodes: string[] = [];
      const processNode = (nodeId: string) => {
        const node = mapping[nodeId];
        
        // If this is a user/assistant message, add it to our list
        if (node.message && 
            node.message.author.role !== 'system' && 
            node.message.author.role !== 'tool') {
          userNodes.push(nodeId);
          return;
        }
        
        // Otherwise, continue through children
        if (node.children) {
          node.children.forEach(childId => processNode(childId));
        }
      };
      
      mapping[rootId].children.forEach(childId => processNode(childId));
      return userNodes;
    };

    // Calculate positions for a node and all its descendants
    const calculatePositions = (nodeId: string, xOffset: number, level = 0) => {
      const node = mapping[nodeId];
      
      // Skip system and tool messages
      if (!node.message || 
          node.message.author.role === 'system' || 
          node.message.author.role === 'tool') {
        return;
      }

      // Set position for current node
      const position = {
        x: xOffset,
        y: level * 150  // Reduced vertical spacing for better visibility
      };
      nodePositions.set(nodeId, position);

      // Process children
      if (node.children) {
        node.children.forEach(childId => {
          const childNode = mapping[childId];
          if (childNode.message && 
              childNode.message.author.role !== 'system' && 
              childNode.message.author.role !== 'tool') {
            calculatePositions(childId, xOffset, level + 1);
          }
        });
      }
    };

    // Start position calculation from first user nodes
    const firstUserNodes = findFirstUserNodes();
    firstUserNodes.forEach((nodeId, index) => {
      calculatePositions(nodeId, index * 400); // Increased horizontal spacing
    });

    // Create nodes and edges
    Object.keys(mapping).forEach(nodeId => {
      const node = mapping[nodeId];
      
      if (!node.message || 
          node.message.author.role === 'system' || 
          node.message.author.role === 'tool') {
        return;
      }

      const position = nodePositions.get(nodeId);
      if (!position) return;

      const role = node.message.author.role;
      const content = node.message.content.parts?.[0]?.substring(0, 50) + "..." || `node: ${nodeId}`;
      
      newNodes.add({
        ...node,
        position,
        data: {
          label: `[${role}] ${content}`
        }
      });

      if (node.parent) {
        // Only create edges between visible nodes
        const parentNode = mapping[node.parent];
        if (parentNode.message && 
            parentNode.message.author.role !== 'system' && 
            parentNode.message.author.role !== 'tool') {
          newEdges.add({
            id: `${node.parent}-${nodeId}`,
            source: node.parent,
            target: nodeId,
            type: 'smoothstep',
          });
        }
      }
    });

    setNodes(Array.from(newNodes) as any);
    setEdges(Array.from(newEdges) as any);
  };

  useEffect(() => {
    createNodesInOrder(conversationData);
  }, [conversationData]);
 
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );
 
  return (
    <div className="w-full h-full" style={{ height: '90vh', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView // Add this to automatically fit the view to the graph
        defaultEdgeOptions={{ // Add default edge options for better visualization
          type: 'smoothstep',
          animated: true,
        }}>
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

// Create a wrapper component that provides the conversation data
const ConversationTreeWrapper = () => {
  // Your conversation data from the JSON
  const conversationData: ConversationData = {
    "title": "Copyrighted Book Pages Request",
    "create_time": 1729487532.790525,
    "update_time": 1729951872.847868,
    "mapping": {
        "f8d90991-7759-4705-9099-117d0f021e74": {
            "id": "f8d90991-7759-4705-9099-117d0f021e74",
            "message": {
                "id": "f8d90991-7759-4705-9099-117d0f021e74",
                "author": {
                    "role": "system",
                    "name": null,
                    "metadata": {}
                },
                "create_time": null,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        ""
                    ]
                },
                "status": "finished_successfully",
                "end_turn": true,
                "weight": 0.0,
                "metadata": {
                    "is_visually_hidden_from_conversation": true
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "aaa14a4c-82f1-4f00-b301-689e71bc94d2",
            "children": [
                "aaa27038-b822-44a7-90e4-a4ca1e607965",
                "aaa20cfe-73aa-4d78-a791-80eef0a49b5c"
            ]
        },
        "aaa14a4c-82f1-4f00-b301-689e71bc94d2": {
            "id": "aaa14a4c-82f1-4f00-b301-689e71bc94d2",
            "message": null,
            "parent": null,
            "children": [
                "f8d90991-7759-4705-9099-117d0f021e74"
            ]
        },
        "aaa27038-b822-44a7-90e4-a4ca1e607965": {
            "id": "aaa27038-b822-44a7-90e4-a4ca1e607965",
            "message": {
                "id": "aaa27038-b822-44a7-90e4-a4ca1e607965",
                "author": {
                    "role": "user",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487532.796403,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "please add pages 1-19 here: @book{anshelm_hultman_2014,\n  author    = {Jonas Anshelm and Martin Hultman},\n  title     = {Discourses of Global Climate Change: Apocalyptic Framing and Political Antagonisms},\n  year      = {2014},\n  publisher = {Routledge},\n  address   = {London, UK},\n  isbn      = {978-1-138-78131-3},\n  url       = {https://www.routledge.com/Discourses-of-Global-Climate-Change-Apocalyptic-Framing-and-Political/Anshelm-Hultman/p/book/9781138781313},\n}"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "serialization_metadata": {
                        "custom_symbol_offsets": []
                    },
                    "request_id": "8d5ec0560af25f13-ARN",
                    "message_source": null,
                    "timestamp_": "absolute",
                    "message_type": null
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "f8d90991-7759-4705-9099-117d0f021e74",
            "children": [
                "27cfcae1-2b32-4906-8633-325077927af4"
            ]
        },
        "27cfcae1-2b32-4906-8633-325077927af4": {
            "id": "27cfcae1-2b32-4906-8633-325077927af4",
            "message": {
                "id": "27cfcae1-2b32-4906-8633-325077927af4",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487534.991745,
                "update_time": null,
                "content": {
                    "content_type": "model_editable_context",
                    "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.",
                    "repository": null,
                    "repo_summary": null
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "aaa27038-b822-44a7-90e4-a4ca1e607965",
                    "request_id": "8d5ec0560af25f13-ARN",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "aaa27038-b822-44a7-90e4-a4ca1e607965",
            "children": [
                "f861d34a-41c6-4873-a09e-9c19cb72fa8c"
            ]
        },
        "f861d34a-41c6-4873-a09e-9c19cb72fa8c": {
            "id": "f861d34a-41c6-4873-a09e-9c19cb72fa8c",
            "message": {
                "id": "f861d34a-41c6-4873-a09e-9c19cb72fa8c",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487534.991917,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "Sorry, I can't provide pages from copyrighted books. However, I can help you summarize, analyze, or discuss key ideas from the book if that would be helpful to you. Would you like a summary or assistance with specific concepts from the text?"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": true,
                "weight": 1.0,
                "metadata": {
                    "citations": [],
                    "content_references": [],
                    "gizmo_id": null,
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "27cfcae1-2b32-4906-8633-325077927af4",
                    "finish_details": {
                        "type": "stop",
                        "stop_tokens": [
                            200002
                        ]
                    },
                    "is_complete": true,
                    "request_id": "8d5ec0560af25f13-ARN",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "27cfcae1-2b32-4906-8633-325077927af4",
            "children": []
        },
        "aaa20cfe-73aa-4d78-a791-80eef0a49b5c": {
            "id": "aaa20cfe-73aa-4d78-a791-80eef0a49b5c",
            "message": {
                "id": "aaa20cfe-73aa-4d78-a791-80eef0a49b5c",
                "author": {
                    "role": "user",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487552.646416,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "please add pages 1-19 here to the ref bib: @book{anshelm_hultman_2014,\n  author    = {Jonas Anshelm and Martin Hultman},\n  title     = {Discourses of Global Climate Change: Apocalyptic Framing and Political Antagonisms},\n  year      = {2014},\n  publisher = {Routledge},\n  address   = {London, UK},\n  isbn      = {978-1-138-78131-3},\n  url       = {https://www.routledge.com/Discourses-of-Global-Climate-Change-Apocalyptic-Framing-and-Political/Anshelm-Hultman/p/book/9781138781313},\n}"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "request_id": "8d5ec0d1b8f05f13-ARN",
                    "message_source": null,
                    "timestamp_": "absolute",
                    "message_type": null
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "f8d90991-7759-4705-9099-117d0f021e74",
            "children": [
                "3f2a5015-b765-4b57-9431-ca969588f56d"
            ]
        },
        "3f2a5015-b765-4b57-9431-ca969588f56d": {
            "id": "3f2a5015-b765-4b57-9431-ca969588f56d",
            "message": {
                "id": "3f2a5015-b765-4b57-9431-ca969588f56d",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487557.550911,
                "update_time": null,
                "content": {
                    "content_type": "model_editable_context",
                    "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.",
                    "repository": null,
                    "repo_summary": null
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "aaa20cfe-73aa-4d78-a791-80eef0a49b5c",
                    "request_id": "8d5ec0d1b8f05f13-ARN",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "aaa20cfe-73aa-4d78-a791-80eef0a49b5c",
            "children": [
                "dde0f1f6-be98-41d7-9f24-90dacfc5dc8c"
            ]
        },
        "dde0f1f6-be98-41d7-9f24-90dacfc5dc8c": {
            "id": "dde0f1f6-be98-41d7-9f24-90dacfc5dc8c",
            "message": {
                "id": "dde0f1f6-be98-41d7-9f24-90dacfc5dc8c",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729487557.551058,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "To add pages 1-19 to the reference, you can modify the entry as follows:\n\n```bibtex\n@book{anshelm_hultman_2014,\n  author    = {Jonas Anshelm and Martin Hultman},\n  title     = {Discourses of Global Climate Change: Apocalyptic Framing and Political Antagonisms},\n  year      = {2014},\n  publisher = {Routledge},\n  address   = {London, UK},\n  isbn      = {978-1-138-78131-3},\n  url       = {https://www.routledge.com/Discourses-of-Global-Climate-Change-Apocalyptic-Framing-and-Political/Anshelm-Hultman/p/book/9781138781313},\n  pages     = {1--19}\n}\n```\n\nThis will include the specified page range in the bibliography entry."
                    ]
                },
                "status": "finished_successfully",
                "end_turn": true,
                "weight": 1.0,
                "metadata": {
                    "citations": [],
                    "content_references": [],
                    "gizmo_id": null,
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "3f2a5015-b765-4b57-9431-ca969588f56d",
                    "finish_details": {
                        "type": "stop",
                        "stop_tokens": [
                            200002
                        ]
                    },
                    "is_complete": true,
                    "request_id": "8d5ec0d1b8f05f13-ARN",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "3f2a5015-b765-4b57-9431-ca969588f56d",
            "children": [
                "aaa2ba75-0a53-401c-a140-66e793af096f"
            ]
        },
        "aaa2ba75-0a53-401c-a140-66e793af096f": {
            "id": "aaa2ba75-0a53-401c-a140-66e793af096f",
            "message": {
                "id": "aaa2ba75-0a53-401c-a140-66e793af096f",
                "author": {
                    "role": "user",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729951857.558133,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "thanks!"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "serialization_metadata": {
                        "custom_symbol_offsets": []
                    },
                    "request_id": "8d8b08624d661d12-CPH",
                    "message_source": null,
                    "timestamp_": "absolute",
                    "message_type": null
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "dde0f1f6-be98-41d7-9f24-90dacfc5dc8c",
            "children": [
                "24c0ebee-aabf-4181-b983-167c0ae4253f"
            ]
        },
        "24c0ebee-aabf-4181-b983-167c0ae4253f": {
            "id": "24c0ebee-aabf-4181-b983-167c0ae4253f",
            "message": {
                "id": "24c0ebee-aabf-4181-b983-167c0ae4253f",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729951858.613355,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "You're very welcome! Let me know if there's anything else I can help with. Happy referencing! 📚"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": true,
                "weight": 1.0,
                "metadata": {
                    "finish_details": {
                        "type": "stop",
                        "stop_tokens": [
                            200002
                        ]
                    },
                    "is_complete": true,
                    "citations": [],
                    "content_references": [],
                    "gizmo_id": null,
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "aaa2ba75-0a53-401c-a140-66e793af096f",
                    "request_id": "8d8b08624d661d12-CPH",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "aaa2ba75-0a53-401c-a140-66e793af096f",
            "children": [
                "aaa25997-7f30-4e09-94f8-46be4b21e984"
            ]
        },
        "aaa25997-7f30-4e09-94f8-46be4b21e984": {
            "id": "aaa25997-7f30-4e09-94f8-46be4b21e984",
            "message": {
                "id": "aaa25997-7f30-4e09-94f8-46be4b21e984",
                "author": {
                    "role": "user",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729951870.719563,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "i will!"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "serialization_metadata": {
                        "custom_symbol_offsets": []
                    },
                    "request_id": "8d8b08b61d1e1d12-CPH",
                    "message_source": null,
                    "timestamp_": "absolute",
                    "message_type": null
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "24c0ebee-aabf-4181-b983-167c0ae4253f",
            "children": [
                "a220bd6a-98c1-4ada-9651-0bbb7fff60b7"
            ]
        },
        "a220bd6a-98c1-4ada-9651-0bbb7fff60b7": {
            "id": "a220bd6a-98c1-4ada-9651-0bbb7fff60b7",
            "message": {
                "id": "a220bd6a-98c1-4ada-9651-0bbb7fff60b7",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729951872.195743,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "User is referencing specific page ranges in their bibliography entries."
                    ]
                },
                "status": "finished_successfully",
                "end_turn": false,
                "weight": 1.0,
                "metadata": {
                    "finish_details": {
                        "type": "stop",
                        "stop_tokens": [
                            200007
                        ]
                    },
                    "is_complete": true,
                    "citations": [],
                    "content_references": [],
                    "gizmo_id": null,
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "aaa25997-7f30-4e09-94f8-46be4b21e984",
                    "request_id": "8d8b08b61d1e1d12-CPH",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "bio",
                "channel": null
            },
            "parent": "aaa25997-7f30-4e09-94f8-46be4b21e984",
            "children": [
                "4c89f1a2-ee40-41b0-b7a9-98e4242ef688"
            ]
        },
        "4c89f1a2-ee40-41b0-b7a9-98e4242ef688": {
            "id": "4c89f1a2-ee40-41b0-b7a9-98e4242ef688",
            "message": {
                "id": "4c89f1a2-ee40-41b0-b7a9-98e4242ef688",
                "author": {
                    "role": "tool",
                    "name": "bio",
                    "metadata": {}
                },
                "create_time": 1729951872.195848,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "Model set context updated."
                    ]
                },
                "status": "finished_successfully",
                "end_turn": null,
                "weight": 1.0,
                "metadata": {
                    "kwargs": {
                        "message_id": "4c89f1a2-ee40-41b0-b7a9-98e4242ef688",
                        "pending_message_id": null,
                        "sync_write": false
                    },
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "a220bd6a-98c1-4ada-9651-0bbb7fff60b7",
                    "request_id": "8d8b08b61d1e1d12-CPH",
                    "timestamp_": "absolute"
                },
                "recipient": "assistant",
                "channel": null
            },
            "parent": "a220bd6a-98c1-4ada-9651-0bbb7fff60b7",
            "children": [
                "00c94011-4170-48f0-88ea-eaee07ceb7b8"
            ]
        },
        "00c94011-4170-48f0-88ea-eaee07ceb7b8": {
            "id": "00c94011-4170-48f0-88ea-eaee07ceb7b8",
            "message": {
                "id": "00c94011-4170-48f0-88ea-eaee07ceb7b8",
                "author": {
                    "role": "assistant",
                    "name": null,
                    "metadata": {}
                },
                "create_time": 1729951872.195914,
                "update_time": null,
                "content": {
                    "content_type": "text",
                    "parts": [
                        "Great! I'm here whenever you need more help with your references or anything else. Happy working! 📘"
                    ]
                },
                "status": "finished_successfully",
                "end_turn": true,
                "weight": 1.0,
                "metadata": {
                    "finish_details": {
                        "type": "stop",
                        "stop_tokens": [
                            200002
                        ]
                    },
                    "is_complete": true,
                    "citations": [],
                    "content_references": [],
                    "gizmo_id": null,
                    "message_type": null,
                    "model_slug": "gpt-4o",
                    "default_model_slug": "auto",
                    "parent_id": "4c89f1a2-ee40-41b0-b7a9-98e4242ef688",
                    "request_id": "8d8b08b61d1e1d12-CPH",
                    "timestamp_": "absolute",
                    "model_switcher_deny": []
                },
                "recipient": "all",
                "channel": null
            },
            "parent": "4c89f1a2-ee40-41b0-b7a9-98e4242ef688",
            "children": []
        }
    },
    "moderation_results": [],
    "current_node": "00c94011-4170-48f0-88ea-eaee07ceb7b8",
    "plugin_ids": null,
    "conversation_id": "6715e2ac-9008-8002-8795-1af276ec59fa",
    "conversation_template_id": null,
    "gizmo_id": null,
    "is_archived": false,
    "safe_urls": [
        "https://www.routledge.com/Discourses-of-Global-Climate-Change-Apocalyptic-Framing-and-Political/Anshelm-Hultman/p/book/9781138781313"
    ],
    "default_model_slug": "auto",
    "conversation_origin": null,
    "voice": null,
    "async_status": null
}

  return <ConversationTree conversationData={conversationData} />;
};

export default ConversationTreeWrapper;

