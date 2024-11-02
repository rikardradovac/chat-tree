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
import ContextMenu from './context-menu';
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

type MenuState = {
    role: string;
    top: number | boolean;
    left: number | boolean;
    right: number | boolean;
    bottom: number | boolean;
  } | null;

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
  const [menu, setMenu] = useState<MenuState>(null);
  const ref = useRef<HTMLDivElement>(null);

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
    // const fetchData = async () => {
    //     // fetch data using chrome extension api
    //   try {
    //     const response = await chrome.runtime.sendMessage({ action: "fetchConversationHistory" });
    //     if (response.success) {
    //       setConversationData(response.data);
    //     } else {
    //       console.error('Failed to fetch conversation data:', response.error);
    //     }
    //   } catch (error) {
    //     console.error('Error fetching conversation data:', error);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    
    // fetchData();

    let data: ConversationData = {
        "title": "Find Bearer Token Chrome",
        "create_time": 1730146227.46676,
        "update_time": 1730311775.123196,
        "mapping": {
            "7832e0cd-62b4-4016-8d2d-66281d1aa613": {
                "id": "7832e0cd-62b4-4016-8d2d-66281d1aa613",
                "message": {
                    "id": "7832e0cd-62b4-4016-8d2d-66281d1aa613",
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
                "parent": "aaa1fe2c-727a-4a11-b484-dee79650d088",
                "children": [
                    "aaa21d90-d678-4767-be3d-15ec3ff3ae40",
                    "aaa286fe-6515-41cc-b4c5-31532d14d2bf",
                    "aaa24ea9-57a8-41fc-8e44-f4053141a4a8"
                ]
            },
            "aaa1fe2c-727a-4a11-b484-dee79650d088": {
                "id": "aaa1fe2c-727a-4a11-b484-dee79650d088",
                "message": null,
                "parent": null,
                "children": [
                    "7832e0cd-62b4-4016-8d2d-66281d1aa613"
                ]
            },
            "aaa21d90-d678-4767-be3d-15ec3ff3ae40": {
                "id": "aaa21d90-d678-4767-be3d-15ec3ff3ae40",
                "message": {
                    "id": "aaa21d90-d678-4767-be3d-15ec3ff3ae40",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730146227.46959,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "when i inspect my network tab i see that my browser has sent request (i use chrome) and it has a bearer token as authorization header. how can i find the token? it isnt anywhere in the cookies or localstorage"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8d9d91b96cd41d06-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "7832e0cd-62b4-4016-8d2d-66281d1aa613",
                "children": [
                    "5339562e-1e5f-4cd1-bd8b-729f60539572"
                ]
            },
            "5339562e-1e5f-4cd1-bd8b-729f60539572": {
                "id": "5339562e-1e5f-4cd1-bd8b-729f60539572",
                "message": {
                    "id": "5339562e-1e5f-4cd1-bd8b-729f60539572",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730146238.790893,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.",
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
                        "parent_id": "aaa21d90-d678-4767-be3d-15ec3ff3ae40",
                        "request_id": "8d9d91b96cd41d06-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa21d90-d678-4767-be3d-15ec3ff3ae40",
                "children": [
                    "44826a11-eb73-4637-9ea6-826744a784db"
                ]
            },
            "44826a11-eb73-4637-9ea6-826744a784db": {
                "id": "44826a11-eb73-4637-9ea6-826744a784db",
                "message": {
                    "id": "44826a11-eb73-4637-9ea6-826744a784db",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730146238.791056,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "If you’re seeing an authorization header with a bearer token in the network tab, that token is being sent directly in the HTTP request headers rather than stored in cookies or local storage. Here’s how you can view it:\n\n1. **Open the Network Tab**: In Chrome DevTools, go to the Network tab.\n2. **Find the Request**: Look for the specific request that contains the `Authorization` header (you might need to expand the list if there are many requests).\n3. **Inspect the Headers**: Click on the request, then navigate to the **Headers** tab. Under \"Request Headers,\" look for the `Authorization` header. It should look like `Authorization: Bearer <token>`.\n4. **Copy the Token**: The token will be visible in plain text right after \"Bearer.\" You can copy it from there for inspection or troubleshooting.\n\nIf you're developing the extension, this token may be injected dynamically by your app rather than being stored in persistent storage."
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
                        "parent_id": "5339562e-1e5f-4cd1-bd8b-729f60539572",
                        "request_id": "8d9d91b96cd41d06-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "5339562e-1e5f-4cd1-bd8b-729f60539572",
                "children": [
                    "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42"
                ]
            },
            "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42": {
                "id": "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42",
                "message": {
                    "id": "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730146277.037758,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "but i want to use chrome extension api to make requests using that token"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8d9d92f58e311d06-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "44826a11-eb73-4637-9ea6-826744a784db",
                "children": [
                    "90dcb271-2f51-4c2f-9afe-6a8bc1a3ec70"
                ]
            },
            "90dcb271-2f51-4c2f-9afe-6a8bc1a3ec70": {
                "id": "90dcb271-2f51-4c2f-9afe-6a8bc1a3ec70",
                "message": {
                    "id": "90dcb271-2f51-4c2f-9afe-6a8bc1a3ec70",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730146312.080632,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "To access the token for use in your Chrome extension, you’ll need a way to retrieve it dynamically from the page's network requests. However, Chrome extensions don’t directly provide access to the request headers of network requests for security reasons. Here’s a workaround using `chrome.webRequest` or `chrome.scripting` API, depending on where the token is available and how your extension needs to use it:\n\n### Approach 1: Use `chrome.webRequest` to Monitor Requests (if the token is in outgoing requests)\nYou can intercept network requests and capture the `Authorization` header if it’s present. Here’s how:\n\n1. **Add Permissions**: In `manifest.json`, request permission to monitor network requests. Add:\n   ```json\n   \"permissions\": [\n       \"webRequest\",\n       \"webRequestBlocking\",\n       \"<all_urls>\"\n   ]\n   ```\n\n2. **Set Up a Background Script**: In your background script, use `chrome.webRequest.onBeforeSendHeaders` to capture the authorization header.\n\n   ```javascript\n   chrome.webRequest.onBeforeSendHeaders.addListener(\n       (details) => {\n           const authHeader = details.requestHeaders.find(header => header.name.toLowerCase() === 'authorization');\n           if (authHeader && authHeader.value.startsWith('Bearer ')) {\n               const token = authHeader.value.split(' ')[1];\n               // You can now save the token to chrome storage or pass it to other parts of your extension\n               chrome.storage.local.set({ token });\n           }\n       },\n       { urls: [\"<all_urls>\"] },\n       [\"requestHeaders\"]\n   );\n   ```\n\n3. **Access the Token**: Retrieve the token from `chrome.storage` wherever you need it within your extension.\n\n   ```javascript\n   chrome.storage.local.get('token', ({ token }) => {\n       if (token) {\n           // Use the token in API requests\n       }\n   });\n   ```\n\n### Approach 2: Inject Content Script to Retrieve Token Directly from JavaScript on the Page (if the token is only accessible within page context)\n\nIf the token is set by JavaScript on the page, you might be able to use a content script to retrieve it:\n\n1. **Inject a Content Script**: Add a content script that runs on the target page.\n2. **Access the Token via JavaScript**: If you can locate where the token is stored in JavaScript variables, you might be able to access it directly and pass it to the background script.\n\n   ```javascript\n   // In content script\n   const token = someGlobalVariableHoldingTheToken; // Replace with the actual variable or retrieval logic\n\n   // Send token to the background script\n   chrome.runtime.sendMessage({ token });\n   ```\n\n3. **Store or Use the Token in Background Script**:\n   ```javascript\n   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {\n       if (message.token) {\n           chrome.storage.local.set({ token: message.token });\n       }\n   });\n   ```\n\nThese methods let you capture the token dynamically without relying on local storage or cookies on the page, enabling your extension to make API requests securely using the same token. Let me know if you’d like more help with a specific part!"
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
                        "parent_id": "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42",
                        "request_id": "8d9d92f58e311d06-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa282c6-60f9-40fd-bf5a-7f1c299e7f42",
                "children": [
                    "aaa233d8-e0d7-4949-907c-9fc778f0937a"
                ]
            },
            "aaa233d8-e0d7-4949-907c-9fc778f0937a": {
                "id": "aaa233d8-e0d7-4949-907c-9fc778f0937a",
                "message": {
                    "id": "aaa233d8-e0d7-4949-907c-9fc778f0937a",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730147870.661548,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "thanks"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8d9db9dd5ab09308-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "90dcb271-2f51-4c2f-9afe-6a8bc1a3ec70",
                "children": [
                    "a10c76bc-424c-4575-8c08-c36d54c74017"
                ]
            },
            "a10c76bc-424c-4575-8c08-c36d54c74017": {
                "id": "a10c76bc-424c-4575-8c08-c36d54c74017",
                "message": {
                    "id": "a10c76bc-424c-4575-8c08-c36d54c74017",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730147873.031573,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "You're very welcome! 😊  Good luck with your Chrome extension, and feel free to ask if you run into any other questions along the way. Happy coding! 🚀"
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
                        "parent_id": "aaa233d8-e0d7-4949-907c-9fc778f0937a",
                        "request_id": "8d9db9dd5ab09308-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa233d8-e0d7-4949-907c-9fc778f0937a",
                "children": []
            },
            "aaa286fe-6515-41cc-b4c5-31532d14d2bf": {
                "id": "aaa286fe-6515-41cc-b4c5-31532d14d2bf",
                "message": {
                    "id": "aaa286fe-6515-41cc-b4c5-31532d14d2bf",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275570.441444,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "what can i do to stop being so disctracted by my phone?\n"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "request_id": "8da9e7888da5abc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "7832e0cd-62b4-4016-8d2d-66281d1aa613",
                "children": [
                    "9c5b6f7b-4184-42f0-9f37-892023b86bbd"
                ]
            },
            "9c5b6f7b-4184-42f0-9f37-892023b86bbd": {
                "id": "9c5b6f7b-4184-42f0-9f37-892023b86bbd",
                "message": {
                    "id": "9c5b6f7b-4184-42f0-9f37-892023b86bbd",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275588.68194,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.",
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
                        "parent_id": "aaa286fe-6515-41cc-b4c5-31532d14d2bf",
                        "request_id": "8da9e7888da5abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa286fe-6515-41cc-b4c5-31532d14d2bf",
                "children": [
                    "b27c63cc-730c-4647-bbc0-dcec9776385e"
                ]
            },
            "b27c63cc-730c-4647-bbc0-dcec9776385e": {
                "id": "b27c63cc-730c-4647-bbc0-dcec9776385e",
                "message": {
                    "id": "b27c63cc-730c-4647-bbc0-dcec9776385e",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275588.682047,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Phone distractions can be really hard to manage! Here are some strategies you might find helpful:\n\n1. **Limit App Notifications**: Turn off notifications for most apps, leaving only essential ones on. This minimizes constant disruptions that draw you back to your phone.\n\n2. **Set App Time Limits**: Use built-in features like *Screen Time* on iOS or *Digital Wellbeing* on Android to set time limits for specific apps. You’ll get notified when you've reached your daily limit, helping you stay mindful of usage.\n\n3. **Use Focus Modes**: Explore focus modes like *Do Not Disturb*, *Work Focus*, or *Personal Focus* modes to filter which notifications can come through, based on your current activity.\n\n4. **Organize Your Home Screen**: Move distracting apps off your home screen, so they’re less accessible. Alternatively, try a minimalist layout with only essential apps visible.\n\n5. **Set Specific Times for Phone Use**: Set aside particular times of the day when you check your phone. In between, keep your phone out of reach or sight, like in a drawer or another room.\n\n6. **Try Monochrome Mode**: Set your screen to grayscale. The lack of color can make your phone less enticing and reduce the appeal of apps designed with bright, engaging colors.\n\n7. **Mindfulness Practices**: When you feel an urge to check your phone, pause, take a breath, and ask yourself if it’s necessary or just a habit. This helps build awareness of when and why you’re reaching for it.\n\n8. **Leverage Digital Wellbeing Apps**: Apps like *Forest*, *Freedom*, or *Moment* help you stay off your phone. Some gamify the experience, rewarding you for time spent off-screen.\n\n9. **Replace Phone Time with a Hobby**: Engage in a screen-free hobby (reading, journaling, drawing) that can absorb you as much as your phone does.\n\n10. **Reflect on Your Usage Goals**: Consider why you want to reduce phone time. When you have clear reasons, it’s easier to stick with the habit.\n\nIt’s all about finding what works best for you, so try a combination of these and see what feels right. Let me know if there’s a specific area you’re struggling with—sometimes tailoring strategies can make all the difference!"
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
                        "parent_id": "9c5b6f7b-4184-42f0-9f37-892023b86bbd",
                        "request_id": "8da9e7888da5abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "9c5b6f7b-4184-42f0-9f37-892023b86bbd",
                "children": [
                    "aaa217f3-9eea-4638-8d15-568a65cd2629",
                    "aaa25a78-6012-44eb-883b-d4186be6678e"
                ]
            },
            "aaa217f3-9eea-4638-8d15-568a65cd2629": {
                "id": "aaa217f3-9eea-4638-8d15-568a65cd2629",
                "message": {
                    "id": "aaa217f3-9eea-4638-8d15-568a65cd2629",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275623.561378,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "i curently do these steps but find myself struggling still. should i just put it in another room where it is out of reach?"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8da9e8d51a49abc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "b27c63cc-730c-4647-bbc0-dcec9776385e",
                "children": [
                    "df4a463b-02e2-4a37-9d54-fc9492e263ea"
                ]
            },
            "df4a463b-02e2-4a37-9d54-fc9492e263ea": {
                "id": "df4a463b-02e2-4a37-9d54-fc9492e263ea",
                "message": {
                    "id": "df4a463b-02e2-4a37-9d54-fc9492e263ea",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275632.33811,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "User currently uses strategies like limiting app notifications, setting app time limits, and using focus modes to reduce phone distractions but still finds it challenging to avoid their phone."
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
                        "parent_id": "aaa217f3-9eea-4638-8d15-568a65cd2629",
                        "request_id": "8da9e8d51a49abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "bio",
                    "channel": null
                },
                "parent": "aaa217f3-9eea-4638-8d15-568a65cd2629",
                "children": [
                    "0f5a2a04-9289-475d-8967-72e644ca608e"
                ]
            },
            "0f5a2a04-9289-475d-8967-72e644ca608e": {
                "id": "0f5a2a04-9289-475d-8967-72e644ca608e",
                "message": {
                    "id": "0f5a2a04-9289-475d-8967-72e644ca608e",
                    "author": {
                        "role": "tool",
                        "name": "bio",
                        "metadata": {}
                    },
                    "create_time": 1730275632.338294,
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
                            "message_id": "0f5a2a04-9289-475d-8967-72e644ca608e",
                            "pending_message_id": null,
                            "sync_write": false
                        },
                        "message_type": null,
                        "model_slug": "gpt-4o",
                        "default_model_slug": "auto",
                        "parent_id": "df4a463b-02e2-4a37-9d54-fc9492e263ea",
                        "request_id": "8da9e8d51a49abc8-CPH",
                        "timestamp_": "absolute"
                    },
                    "recipient": "assistant",
                    "channel": null
                },
                "parent": "df4a463b-02e2-4a37-9d54-fc9492e263ea",
                "children": [
                    "9fe027c0-7da2-426d-930d-5e0a603403c7"
                ]
            },
            "9fe027c0-7da2-426d-930d-5e0a603403c7": {
                "id": "9fe027c0-7da2-426d-930d-5e0a603403c7",
                "message": {
                    "id": "9fe027c0-7da2-426d-930d-5e0a603403c7",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275632.338406,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Yes, putting your phone in another room can be very effective! When it's out of reach, it adds a small barrier that can make a big difference, especially if the habit is mostly reflexive. You could try placing it somewhere inconvenient to access, like another floor or in a drawer. \n\nTo make it easier, you might combine this with having something more engaging nearby—like a book, journal, or any task you’re focusing on—so that reaching for your phone feels less compelling in comparison. If you’re working on a project or study session, try setting a timer to check your phone only when it goes off (like after 25 or 30 minutes), so you build a pattern of intentional checks. \n\nSometimes, creating a new environment for focus without your phone entirely is the best way to break that cycle!"
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
                        "parent_id": "0f5a2a04-9289-475d-8967-72e644ca608e",
                        "request_id": "8da9e8d51a49abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "0f5a2a04-9289-475d-8967-72e644ca608e",
                "children": []
            },
            "aaa25a78-6012-44eb-883b-d4186be6678e": {
                "id": "aaa25a78-6012-44eb-883b-d4186be6678e",
                "message": {
                    "id": "aaa25a78-6012-44eb-883b-d4186be6678e",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275710.757622,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "how do i convince myself that i am not missing out on stuff?\n"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "request_id": "8da9eaf63cf5abc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "b27c63cc-730c-4647-bbc0-dcec9776385e",
                "children": [
                    "d7eea2dd-bf94-4b83-88db-b59bbda65d94"
                ]
            },
            "d7eea2dd-bf94-4b83-88db-b59bbda65d94": {
                "id": "d7eea2dd-bf94-4b83-88db-b59bbda65d94",
                "message": {
                    "id": "d7eea2dd-bf94-4b83-88db-b59bbda65d94",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275727.531179,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.\n\n19. [2024-10-30]. User currently uses strategies like limiting app notifications, setting app time limits, and using focus modes to reduce phone distractions but still finds it challenging to avoid their phone.",
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
                        "parent_id": "aaa25a78-6012-44eb-883b-d4186be6678e",
                        "request_id": "8da9eaf63cf5abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa25a78-6012-44eb-883b-d4186be6678e",
                "children": [
                    "f5f90c90-f48c-4297-a3e5-3bd3c07be70f"
                ]
            },
            "f5f90c90-f48c-4297-a3e5-3bd3c07be70f": {
                "id": "f5f90c90-f48c-4297-a3e5-3bd3c07be70f",
                "message": {
                    "id": "f5f90c90-f48c-4297-a3e5-3bd3c07be70f",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275727.531338,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "The fear of missing out (FOMO) can be so powerful, especially with social media constantly showcasing what others are doing. Here are some ways to reshape your mindset and ease that feeling:\n\n1. **Shift Your Focus to Personal Goals**: Make a list of things that genuinely matter to you—personal goals, relationships, skills you want to develop. When you’re working on what you care about, it’s easier to feel fulfilled and less inclined to compare.\n\n2. **Practice Contentment with Small Wins**: Instead of focusing on what you might be missing, try to appreciate the positive things in your daily life. Reflecting on these regularly can help build a sense of gratitude for what you already have.\n\n3. **Take Social Media Breaks**: Social media often fuels FOMO because it’s a constant highlight reel. Taking a break (even for a day or two) can help you recalibrate, giving you space to reconnect with your own interests without the pressure of what others are up to.\n\n4. **Remind Yourself of the “Highlight Reel” Effect**: Social media is usually an edited, filtered version of reality. Remind yourself that everyone has ups and downs that you may never see, and what you’re viewing is often just the best (or most dramatic) moments.\n\n5. **Focus on Being Present**: When you focus on the here and now, your attention is less on hypothetical things you might be missing. Practice being fully present in conversations, activities, or even quiet moments. The more you enjoy the now, the less you’ll feel like you’re missing out.\n\n6. **Reflect on Times You’ve Had Fun Without “Knowing Everything”**: Look back on enjoyable experiences you had before knowing every update from social media. You didn’t miss out then, and you don’t need constant updates to live fully now.\n\n7. **Reframe Your View of Missing Out**: Sometimes, not knowing or not attending every event can be freeing—it allows for rest, self-care, or other activities that make you feel grounded.\n\n8. **Remember Everyone’s Path is Unique**: You’re building your own life and experiences that are valuable in their own right. Remind yourself that life isn’t a comparison game; you’re creating your own story, and that’s enough.\n\nChanging your mindset can take time, so be patient with yourself! It’s normal to feel FOMO now and then, but these strategies can help make it less overwhelming. "
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
                        "parent_id": "d7eea2dd-bf94-4b83-88db-b59bbda65d94",
                        "request_id": "8da9eaf63cf5abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "d7eea2dd-bf94-4b83-88db-b59bbda65d94",
                "children": [
                    "aaa2571f-d856-4638-8adb-27b5b817cc39"
                ]
            },
            "aaa2571f-d856-4638-8adb-27b5b817cc39": {
                "id": "aaa2571f-d856-4638-8adb-27b5b817cc39",
                "message": {
                    "id": "aaa2571f-d856-4638-8adb-27b5b817cc39",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275778.844888,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "no i meant with the phone thing. but another thing that is really tough is imposter syndrome. i work a lot but it still feels as if everyone else us much better and i am just stupid"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8da9ec9f8d71abc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "f5f90c90-f48c-4297-a3e5-3bd3c07be70f",
                "children": [
                    "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3"
                ]
            },
            "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3": {
                "id": "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3",
                "message": {
                    "id": "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275806.142904,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "User experiences imposter syndrome, feeling as if others are much better despite working hard."
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
                        "parent_id": "aaa2571f-d856-4638-8adb-27b5b817cc39",
                        "request_id": "8da9ec9f8d71abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "bio",
                    "channel": null
                },
                "parent": "aaa2571f-d856-4638-8adb-27b5b817cc39",
                "children": [
                    "55320b07-dd40-405e-9c6f-f1ad20ab2979"
                ]
            },
            "55320b07-dd40-405e-9c6f-f1ad20ab2979": {
                "id": "55320b07-dd40-405e-9c6f-f1ad20ab2979",
                "message": {
                    "id": "55320b07-dd40-405e-9c6f-f1ad20ab2979",
                    "author": {
                        "role": "tool",
                        "name": "bio",
                        "metadata": {}
                    },
                    "create_time": 1730275806.143022,
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
                            "message_id": "55320b07-dd40-405e-9c6f-f1ad20ab2979",
                            "pending_message_id": null,
                            "sync_write": false
                        },
                        "message_type": null,
                        "model_slug": "gpt-4o",
                        "default_model_slug": "auto",
                        "parent_id": "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3",
                        "request_id": "8da9ec9f8d71abc8-CPH",
                        "timestamp_": "absolute"
                    },
                    "recipient": "assistant",
                    "channel": null
                },
                "parent": "2a04ff7e-8ed9-4cf1-bcf7-9ad9b4a109a3",
                "children": [
                    "b68a6a7e-4090-4ee6-ab72-614e4a573abe"
                ]
            },
            "b68a6a7e-4090-4ee6-ab72-614e4a573abe": {
                "id": "b68a6a7e-4090-4ee6-ab72-614e4a573abe",
                "message": {
                    "id": "b68a6a7e-4090-4ee6-ab72-614e4a573abe",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275806.143091,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "I get it now! When you’re stepping away from your phone, it can trigger FOMO because it feels like you might miss important updates or fall behind. Here are some ways to counter this feeling and stay grounded:\n\n1. **Set Boundaries for Updates**: Decide on specific times during the day to check in, like once in the morning and once in the evening. This way, you’re still connected but not constantly checking. Knowing you have time set aside can ease the worry of missing out.\n\n2. **Prioritize Deep Connections Over Updates**: Remind yourself that close relationships and meaningful work are more fulfilling than staying up-to-date on every notification. Try focusing on deeper connections by setting aside time to chat with friends or family directly.\n\n3. **Remind Yourself of the Benefits**: Every time you step away from your phone, you’re giving yourself a break from the noise and a chance to focus on your own growth and goals. Reflect on how this time helps you build more valuable skills and rest.\n\n4. **Practice a “Let It Go” Mindset**: Challenge yourself to view phone time as something you can let go of, even if it’s just for 20–30 minutes. Most notifications can wait, and you may find that you didn’t miss out on anything major after all.\n\n5. **Remember that Constant Checking Doesn’t Equal Productivity**: Your work, learning, or personal life doesn’t depend on staying constantly connected. Checking less often can help you work more deeply and efficiently, which ultimately strengthens your abilities and confidence.\n\nAs for imposter syndrome, it’s such a common struggle—especially when you’re working hard and still feeling like it’s not enough. Here are a few thoughts:\n\n1. **Recognize the Gap Between Perception and Reality**: Often, what you perceive as “everyone else being better” is exaggerated. People tend to showcase their strengths, but you’re only seeing the surface. What looks easy to others might not be, and they may feel similarly about their skills.\n\n2. **List Your Wins Regularly**: It’s easy to downplay your own achievements. Try making a quick note of each day’s accomplishments, no matter how small. Over time, this list can be a tangible reminder that you’re learning and achieving.\n\n3. **Reframe “Everyone Else”**: It’s possible that people you compare yourself to admire qualities you have, too. Remember that everyone has different strengths; focus on building yours rather than comparing your journey with others'.\n\n4. **Take Stock of the Facts**: Reflect on real evidence that shows you’re capable—like the projects you’ve successfully completed, the feedback you’ve received, or the ways you’ve grown. These concrete reminders can help combat feelings of inadequacy.\n\n5. **Acknowledge Your Effort**: Working hard itself is a huge strength, and many successful people deal with imposter syndrome. The feeling doesn’t mean you’re not skilled or intelligent; it often just means you’re stepping outside your comfort zone and challenging yourself, which is how you grow.\n\nHang in there! Both dealing with phone FOMO and tackling imposter syndrome take time, but you’re already putting in the effort, which is a sign you’re progressing even more than you might realize."
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
                        "parent_id": "55320b07-dd40-405e-9c6f-f1ad20ab2979",
                        "request_id": "8da9ec9f8d71abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "55320b07-dd40-405e-9c6f-f1ad20ab2979",
                "children": [
                    "aaa2814f-14b2-4093-bf0c-238d16d12be4"
                ]
            },
            "aaa2814f-14b2-4093-bf0c-238d16d12be4": {
                "id": "aaa2814f-14b2-4093-bf0c-238d16d12be4",
                "message": {
                    "id": "aaa2814f-14b2-4093-bf0c-238d16d12be4",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275944.558215,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "u truly want to get to san francisco to work for some ai company. i am currently studying and have been working for soon three years with machine learning. yet it feels as if i am not good enough and i am seeing so many other people living my dream."
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8da9f0ab3845abc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "b68a6a7e-4090-4ee6-ab72-614e4a573abe",
                "children": [
                    "9d51b059-c338-4fd1-8193-dfd89381c2fb"
                ]
            },
            "9d51b059-c338-4fd1-8193-dfd89381c2fb": {
                "id": "9d51b059-c338-4fd1-8193-dfd89381c2fb",
                "message": {
                    "id": "9d51b059-c338-4fd1-8193-dfd89381c2fb",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275961.942863,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.\n\n19. [2024-10-30]. User currently uses strategies like limiting app notifications, setting app time limits, and using focus modes to reduce phone distractions but still finds it challenging to avoid their phone.\n\n20. [2024-10-30]. User experiences imposter syndrome, feeling as if others are much better despite working hard.",
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
                        "parent_id": "aaa2814f-14b2-4093-bf0c-238d16d12be4",
                        "request_id": "8da9f0ab3845abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa2814f-14b2-4093-bf0c-238d16d12be4",
                "children": [
                    "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec"
                ]
            },
            "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec": {
                "id": "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec",
                "message": {
                    "id": "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275961.942989,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "User wants to work for an AI company in San Francisco and is currently studying with nearly three years of experience in machine learning."
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
                        "parent_id": "9d51b059-c338-4fd1-8193-dfd89381c2fb",
                        "request_id": "8da9f0ab3845abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "bio",
                    "channel": null
                },
                "parent": "9d51b059-c338-4fd1-8193-dfd89381c2fb",
                "children": [
                    "62c6f859-6ab2-41db-a69e-3092bbeadf0a"
                ]
            },
            "62c6f859-6ab2-41db-a69e-3092bbeadf0a": {
                "id": "62c6f859-6ab2-41db-a69e-3092bbeadf0a",
                "message": {
                    "id": "62c6f859-6ab2-41db-a69e-3092bbeadf0a",
                    "author": {
                        "role": "tool",
                        "name": "bio",
                        "metadata": {}
                    },
                    "create_time": 1730275961.94307,
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
                            "message_id": "62c6f859-6ab2-41db-a69e-3092bbeadf0a",
                            "pending_message_id": null,
                            "sync_write": false
                        },
                        "message_type": null,
                        "model_slug": "gpt-4o",
                        "default_model_slug": "auto",
                        "parent_id": "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec",
                        "request_id": "8da9f0ab3845abc8-CPH",
                        "timestamp_": "absolute"
                    },
                    "recipient": "assistant",
                    "channel": null
                },
                "parent": "6ae008a4-3fd0-49e1-9c45-f3cf0050d1ec",
                "children": [
                    "7a949d56-59ab-4f12-84db-a343b1981fb3"
                ]
            },
            "7a949d56-59ab-4f12-84db-a343b1981fb3": {
                "id": "7a949d56-59ab-4f12-84db-a343b1981fb3",
                "message": {
                    "id": "7a949d56-59ab-4f12-84db-a343b1981fb3",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730275961.943173,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Your ambition is clear, and you’ve already put in a significant amount of work to build a foundation in machine learning. That sense of falling behind or not being \"good enough\" is understandable when you see others seemingly living the dream. Here are a few thoughts that might help you reframe this feeling and build confidence:\n\n1. **Remember Your Unique Path**: Every person’s journey to a dream job is unique, with different timelines, strengths, and opportunities. You’re steadily building both experience and knowledge, and three years in ML is an impressive foundation that a lot of people are working toward.\n\n2. **Identify Specific Skills to Close the Gap**: Instead of focusing on others’ achievements, try zeroing in on specific skills that will strengthen your own profile. San Francisco companies look for problem-solvers with hands-on experience, so pinpointing areas like practical AI applications, deployment skills, or research projects can help bridge any gaps you feel.\n\n3. **Build Connections and Seek Mentors**: Reaching out to professionals in the field, perhaps those working in San Francisco, can be incredibly motivating. LinkedIn or industry conferences are good places to connect with people and learn about their journeys, which can be reassuring and informative.\n\n4. **Focus on Small Wins and Milestones**: Instead of the overarching “AI job in SF” goal, break it down into achievable steps (e.g., completing a specific ML project, publishing a paper, gaining a skill in deployment frameworks). Each milestone is progress and brings you closer to your larger goal.\n\n5. **Reframe “Competitor” as “Inspiration”**: When you see others working in your dream field, view their paths as inspiration and proof that it’s possible. Many people in the field have felt imposter syndrome or like they weren’t good enough, and yet they succeeded by persisting.\n\n6. **Trust the Process and Your Progress**: You’re actively working toward this goal every day, and those efforts are cumulative. Your consistency and dedication are what set you apart, even if it’s not always immediately visible.\n\nRemember that many people in top positions felt just like you and continued pressing forward. You’re on the right path, and the work you’re doing will absolutely open doors. Stay patient, and keep your focus on your unique journey—it’s valuable in its own right."
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
                        "parent_id": "62c6f859-6ab2-41db-a69e-3092bbeadf0a",
                        "request_id": "8da9f0ab3845abc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "62c6f859-6ab2-41db-a69e-3092bbeadf0a",
                "children": [
                    "aaa260c9-9fa3-42ee-98d2-da50380187b5"
                ]
            },
            "aaa260c9-9fa3-42ee-98d2-da50380187b5": {
                "id": "aaa260c9-9fa3-42ee-98d2-da50380187b5",
                "message": {
                    "id": "aaa260c9-9fa3-42ee-98d2-da50380187b5",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730276127.190854,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "the problem is that i am from sweden and there is no easy way for me to get to san francisco. what can i do i dont want to just trust the process"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8da9f5209beaabc8-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "7a949d56-59ab-4f12-84db-a343b1981fb3",
                "children": [
                    "a930fde8-9301-4838-9da6-f085a057e198"
                ]
            },
            "a930fde8-9301-4838-9da6-f085a057e198": {
                "id": "a930fde8-9301-4838-9da6-f085a057e198",
                "message": {
                    "id": "a930fde8-9301-4838-9da6-f085a057e198",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730276146.939598,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.\n\n19. [2024-10-30]. User currently uses strategies like limiting app notifications, setting app time limits, and using focus modes to reduce phone distractions but still finds it challenging to avoid their phone.\n\n20. [2024-10-30]. User experiences imposter syndrome, feeling as if others are much better despite working hard.\n\n21. [2024-10-30]. User wants to work for an AI company in San Francisco and is currently studying with nearly three years of experience in machine learning.",
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
                        "parent_id": "aaa260c9-9fa3-42ee-98d2-da50380187b5",
                        "request_id": "8da9f5209beaabc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa260c9-9fa3-42ee-98d2-da50380187b5",
                "children": [
                    "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2"
                ]
            },
            "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2": {
                "id": "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2",
                "message": {
                    "id": "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730276146.939721,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "User is from Sweden and is looking for concrete steps to increase their chances of working for an AI company in San Francisco."
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
                        "parent_id": "a930fde8-9301-4838-9da6-f085a057e198",
                        "request_id": "8da9f5209beaabc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "bio",
                    "channel": null
                },
                "parent": "a930fde8-9301-4838-9da6-f085a057e198",
                "children": [
                    "7ad70601-dd80-450b-8710-2d97e414a399"
                ]
            },
            "7ad70601-dd80-450b-8710-2d97e414a399": {
                "id": "7ad70601-dd80-450b-8710-2d97e414a399",
                "message": {
                    "id": "7ad70601-dd80-450b-8710-2d97e414a399",
                    "author": {
                        "role": "tool",
                        "name": "bio",
                        "metadata": {}
                    },
                    "create_time": 1730276146.939804,
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
                            "message_id": "7ad70601-dd80-450b-8710-2d97e414a399",
                            "pending_message_id": null,
                            "sync_write": false
                        },
                        "message_type": null,
                        "model_slug": "gpt-4o",
                        "default_model_slug": "auto",
                        "parent_id": "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2",
                        "request_id": "8da9f5209beaabc8-CPH",
                        "timestamp_": "absolute"
                    },
                    "recipient": "assistant",
                    "channel": null
                },
                "parent": "6f0a7bc9-59b5-4962-a55d-fba94e6b24e2",
                "children": [
                    "618fd5e4-ea58-44e8-abd3-21539aaf0a79"
                ]
            },
            "618fd5e4-ea58-44e8-abd3-21539aaf0a79": {
                "id": "618fd5e4-ea58-44e8-abd3-21539aaf0a79",
                "message": {
                    "id": "618fd5e4-ea58-44e8-abd3-21539aaf0a79",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730276146.939876,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Since you're aiming for a competitive market from abroad, here are some actionable steps that can help make the goal more tangible:\n\n1. **Remote Roles and Contract Work**: Many AI companies in San Francisco hire internationally for remote roles, especially for ML research and development. This could be a way to start building a presence in the U.S. market. Contract or freelance work could also help you demonstrate your skills directly with U.S. companies and build contacts.\n\n2. **Build a Public Portfolio**: Showcase your ML expertise with open-source projects, a portfolio site, or GitHub contributions. Writing blog posts, tutorials, or research papers related to your AI work and sharing them on platforms like Medium or LinkedIn can help you build credibility and get noticed internationally.\n\n3. **Apply for AI and ML Competitions**: High rankings in ML competitions like Kaggle or participation in collaborative research projects can make a significant impression on recruiters. Achieving visibility through these platforms shows technical skills and dedication that are appealing to hiring managers globally.\n\n4. **Network Strategically with SF-Based Professionals**: Reach out to AI professionals in San Francisco, especially those who are open to informational interviews. Attending virtual conferences, meetups, or talks with U.S.-based AI companies can help you meet people in the field and may lead to referrals or opportunities.\n\n5. **Explore U.S. Scholarships or Internships**: Some U.S. universities and AI labs offer research positions or internships that can help you gain experience in the States. Look for specialized programs that allow international students to gain experience or offer sponsorship.\n\n6. **Target Companies Open to Sponsorship**: Some U.S. AI companies are open to visa sponsorship for specialized roles. Research those that have sponsored international candidates before, and consider targeting these companies when applying for jobs or remote work.\n\n7. **Consider a PhD or Advanced Study in the U.S.**: Many U.S. universities are connected to top AI labs and tech companies. A PhD program or even a research-based Master’s in the U.S. can open doors to internships, collaborations, and eventual job placements in Silicon Valley or nearby.\n\nTaking small, focused steps can help you get closer to your goal without having to just \"wait and see.\" By building a strong profile internationally, you’ll make it easier to find ways to cross over into the U.S. AI market."
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
                        "parent_id": "7ad70601-dd80-450b-8710-2d97e414a399",
                        "request_id": "8da9f5209beaabc8-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "7ad70601-dd80-450b-8710-2d97e414a399",
                "children": []
            },
            "aaa24ea9-57a8-41fc-8e44-f4053141a4a8": {
                "id": "aaa24ea9-57a8-41fc-8e44-f4053141a4a8",
                "message": {
                    "id": "aaa24ea9-57a8-41fc-8e44-f4053141a4a8",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730311618.840676,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "what is the best way to market small side projects?"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "request_id": "8dad579f68c3abc2-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "7832e0cd-62b4-4016-8d2d-66281d1aa613",
                "children": [
                    "e61b6e4a-6b86-4167-9161-d944a2697a57"
                ]
            },
            "e61b6e4a-6b86-4167-9161-d944a2697a57": {
                "id": "e61b6e4a-6b86-4167-9161-d944a2697a57",
                "message": {
                    "id": "e61b6e4a-6b86-4167-9161-d944a2697a57",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730311651.338806,
                    "update_time": null,
                    "content": {
                        "content_type": "model_editable_context",
                        "model_set_context": "1. [2024-09-29]. User is implementing Supabase with FastAPI and Python in the backend, and React for the frontend.\n\n2. [2024-09-30]. User is parsing a file containing coordinates, where each row corresponds to one cell, with three coordinates separated by exactly one space. Each coordinate has a sign ('+' or '-'), two digits, a decimal point, and three digits.\n\n3. [2024-09-30]. User is working on an assignment related to high-performance computing that involves counting distances between 3D coordinates using OpenMP for parallelization. The program reads from a file, computes distances between points, and outputs the distance frequency, while handling memory limitations of 5 MiB.\n\n4. [2024-10-01]. User is looking for examples of a master's thesis in NLP related to Recorded Future, with a focus on generative models and ideas that haven't been done and would be beneficial to the company.\n\n5. [2024-10-01]. User is using Tailwind CSS in a React project to display a list of repositories with a refresh button and repository cards.\n\n6. [2024-10-02]. User's project involves training language models with retrieval-augmented generation to improve context understanding and response accuracy, incorporating mechanisms to mitigate hallucinations by implementing response stopping, and using lightweight models (1-10 billion parameters) for efficiency. The goal is to develop an intelligent pipeline for generating accurate and structured reports. The focus is on training the models to learn to use context correctly.\n\n7. [2024-10-03]. User is using Supabase for authentication in a web app with React on the frontend and FastAPI with Python on the backend, logging in with GitHub via OAuth. They are using Supabase-js to authenticate users and send a bearer token (Supabase access token) and OAuth provider token to the backend API via axios to make API calls on behalf of users using their provider access tokens.\n\n8. [2024-10-04]. User received an interview invitation for a Master's thesis position at Ikea.\n\n9. [2024-10-04]. User uses FastAPI with Supabase database in their project.\n\n10. [2024-10-05]. User is migrating their project from a create-react-app (CRA) project with Vite and Tailwind CSS to Next.js to use SSR and wants to continue running it in Docker. They are switching from a client-side React app built with Vite to Next.js to handle authentication and securely store access tokens server-side instead of in localStorage.\n\n11. [2024-10-05]. User is struggling to securely handle OAuth provider access and refresh tokens in their app where the user logs in with GitHub using Supabase for authentication and the backend (FastAPI) makes requests on behalf of the user to GitHub.\n\n12. [2024-10-05]. User is trying to update their database with an encrypted refresh token but is considering sending the token directly to the backend, where it will be encrypted and stored in the database.\n\n13. [2024-10-05]. User is working on converting their previous React page into a Next.js server-side implementation.\n\n14. [2024-10-05]. User is migrating their React repositories page to Next.js and converting it to work with server-side rendering (SSR) using fetch instead of axios, while addressing the challenge of handling an empty session on the server side.\n\n15. [2024-10-08]. User is using Shadcn for their project.\n\n16. [2024-10-26]. User is referencing specific page ranges in their bibliography entries.\n\n17. [2024-10-28]. User is building a Chrome extension that makes an API request to retrieve data to display in the extension, with minimal permissions for security. The extension requires retrieving specific dynamic values from headers (such as variables not hardcoded) for making the API call. The project is being built using TypeScript.\n\n18. [2024-10-28]. User is using Vite to compile their Chrome extension project.\n\n19. [2024-10-30]. User currently uses strategies like limiting app notifications, setting app time limits, and using focus modes to reduce phone distractions but still finds it challenging to avoid their phone.\n\n20. [2024-10-30]. User experiences imposter syndrome, feeling as if others are much better despite working hard.\n\n21. [2024-10-30]. User wants to work for an AI company in San Francisco and is currently studying with nearly three years of experience in machine learning. They are from Sweden and are looking for concrete steps to increase their chances of working for an AI company in San Francisco.",
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
                        "parent_id": "aaa24ea9-57a8-41fc-8e44-f4053141a4a8",
                        "request_id": "8dad579f68c3abc2-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa24ea9-57a8-41fc-8e44-f4053141a4a8",
                "children": [
                    "1ff1db11-04c4-4351-9af6-8cb5df81abd0"
                ]
            },
            "1ff1db11-04c4-4351-9af6-8cb5df81abd0": {
                "id": "1ff1db11-04c4-4351-9af6-8cb5df81abd0",
                "message": {
                    "id": "1ff1db11-04c4-4351-9af6-8cb5df81abd0",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730311651.33898,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Marketing small side projects effectively, especially when you’re limited on time and budget, can be achieved by leveraging a few key strategies to build awareness and connect with your target audience. Here’s a breakdown:\n\n### 1. **Targeted Social Media Platforms**\n   - **Choose Platforms Wisely**: Focus on platforms where your audience is most active. If your project is visual, Instagram or Pinterest can be valuable; for tech projects, Twitter, LinkedIn, or Reddit might be better.\n   - **Use Relevant Hashtags**: Research and use specific hashtags related to your project or niche to reach interested users.\n   - **Share Progress and Updates**: Show behind-the-scenes updates, early versions, and progress. This keeps followers engaged and builds a community over time.\n\n### 2. **Create Engaging Content**\n   - **Blog About It**: If your project solves a unique problem or uses interesting technology, write blog posts or tutorials that showcase what you’re building. You can post on Medium, Dev.to, or your own website.\n   - **Make Short Videos or GIFs**: Short videos can grab attention quickly. Share demos or quick tutorials on your social media platforms, focusing on the functionality and unique value of your project.\n   - **Email Newsletters**: If you already have an email list, keep your subscribers updated on your project’s development and share valuable content that aligns with their interests.\n\n### 3. **Submit to Relevant Platforms**\n   - **Product Hunt**: If your project is ready to launch or has a functional MVP, Product Hunt is an ideal platform to gain initial traction.\n   - **Subreddits & Forums**: Share your project on relevant subreddits (e.g., r/SaaS, r/SideProject) or niche forums. Be mindful of their self-promotion rules and engage with the community genuinely.\n   - **GitHub or Open-Source Directories**: If your project is open-source, share it on GitHub, and let relevant communities know. This can attract users interested in collaborating or contributing.\n\n### 4. **Reach Out to Micro-Influencers**\n   - Find micro-influencers or bloggers who are interested in projects similar to yours and could introduce it to their followers. They often have highly engaged audiences and might be interested in collaborating or reviewing your project.\n\n### 5. **Network with Your Niche Community**\n   - **Join Groups or Communities**: Join communities on Discord, Slack, or Facebook specific to your niche. Being an active member can help spread the word about your project naturally.\n   - **Networking Events & Meetups**: Attend online or local meetups related to your project’s focus. These can be tech meetups, industry conferences, or hackathons, where you can showcase your work and network with potential users or partners.\n\n### 6. **Use SEO to Drive Organic Traffic**\n   - Create a landing page or simple website and optimize it with relevant keywords. Over time, this can attract organic traffic from search engines, especially if your project addresses a specific niche problem that users may search for.\n\n### 7. **Collect Feedback and Iterate**\n   - **Feedback Platforms**: Consider using beta testers from platforms like Betalist, Indie Hackers, or Reddit. Early feedback can help refine your project and make it more appealing when you officially launch.\n   - **Engage with Early Users**: Use their feedback to make improvements and show that you’re listening to your users."
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
                        "parent_id": "e61b6e4a-6b86-4167-9161-d944a2697a57",
                        "request_id": "8dad579f68c3abc2-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "e61b6e4a-6b86-4167-9161-d944a2697a57",
                "children": [
                    "aaa2f4a2-9516-46d0-8a6d-f616098622a4"
                ]
            },
            "aaa2f4a2-9516-46d0-8a6d-f616098622a4": {
                "id": "aaa2f4a2-9516-46d0-8a6d-f616098622a4",
                "message": {
                    "id": "aaa2f4a2-9516-46d0-8a6d-f616098622a4",
                    "author": {
                        "role": "user",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730311738.376528,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "what about a simple chrome extension?"
                        ]
                    },
                    "status": "finished_successfully",
                    "end_turn": null,
                    "weight": 1.0,
                    "metadata": {
                        "serialization_metadata": {
                            "custom_symbol_offsets": []
                        },
                        "request_id": "8dad5a8ac8e8abc2-CPH",
                        "message_source": null,
                        "timestamp_": "absolute",
                        "message_type": null
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "1ff1db11-04c4-4351-9af6-8cb5df81abd0",
                "children": [
                    "daad0311-b5b1-45d4-8087-6649ccdbe729"
                ]
            },
            "daad0311-b5b1-45d4-8087-6649ccdbe729": {
                "id": "daad0311-b5b1-45d4-8087-6649ccdbe729",
                "message": {
                    "id": "daad0311-b5b1-45d4-8087-6649ccdbe729",
                    "author": {
                        "role": "assistant",
                        "name": null,
                        "metadata": {}
                    },
                    "create_time": 1730311774.281815,
                    "update_time": null,
                    "content": {
                        "content_type": "text",
                        "parts": [
                            "Marketing a simple Chrome extension follows similar principles, with a few Chrome-specific tactics to reach more users effectively. Here are some targeted strategies for a Chrome extension:\n\n### 1. **Optimize Your Chrome Web Store Listing**\n   - **Catchy Title and Icon**: Use a clear and descriptive title that reflects the extension's purpose, and create an eye-catching, professional icon. A simple but recognizable icon helps users remember it.\n   - **Detailed Description**: Write a concise yet informative description that outlines the problem your extension solves, its features, and how users will benefit. Include relevant keywords for better discoverability.\n   - **Screenshots and Demo Video**: Add screenshots and, ideally, a short demo video of the extension in action. Visuals help potential users understand the functionality quickly.\n\n### 2. **Leverage Product Launch Platforms**\n   - **Product Hunt**: Chrome extensions do well on Product Hunt, where you can reach a tech-savvy audience. Make sure to create an appealing Product Hunt post, showcasing the value your extension provides.\n   - **AlternativeTo**: This site lets people find alternatives to popular apps and tools. Listing your extension here can help users looking for similar tools discover it.\n   - **Reddit and Indie Hackers**: Share your extension in niche communities like r/SideProject, r/ChromeExtensions, or Indie Hackers. Just ensure you follow their guidelines and focus on engaging rather than direct promotion.\n\n### 3. **Engage with Tech Communities**\n   - **Developer & Niche Communities**: Join relevant developer communities on platforms like Stack Overflow, Slack, Discord, or GitHub. By contributing to discussions and sharing your project organically, you can attract users who would benefit from your extension.\n   - **Chrome Extension Communities**: Specific communities for Chrome extension developers or enthusiasts (such as certain Facebook groups or subreddits) can help you connect with users interested in trying out new extensions.\n\n### 4. **Create Content Around Your Extension**\n   - **Write Tutorials or Case Studies**: Write tutorials or case studies on how your extension solves specific problems. Submit these to Medium, Dev.to, or your own blog. This helps with SEO and draws in users who are interested in your extension's functionality.\n   - **YouTube or Social Media Demos**: Create a short video showing the extension’s key features and benefits. Posting these on YouTube, LinkedIn, Twitter, or even TikTok can attract users from different platforms who prefer video content.\n\n### 5. **Encourage Reviews and Ratings**\n   - **Ask for Reviews from Early Users**: Positive ratings on the Chrome Web Store help boost your extension’s visibility. Politely ask early users to leave honest reviews. Consider adding a prompt within the extension after a positive user interaction.\n   - **Gather and Act on Feedback**: Monitor user feedback and reviews to continually improve the extension. Users appreciate regular updates, and active maintenance can attract a larger user base over time.\n\n### 6. **Build an Email List or Community**\n   - If you plan on adding more features or building related tools, start an email list or community (on platforms like Discord or a newsletter) to notify users of updates. This can also become a direct channel for user feedback and new feature ideas.\n\n### 7. **Engage on Chrome-Specific SEO**\n   - **Content Around Your Extension’s Niche**: For example, if your extension improves productivity, create SEO-friendly blog content about productivity tools. Linking back to your Chrome extension’s landing page can help attract organic traffic.\n   - **Use Your Landing Page for SEO**: If you have a landing page for the extension, optimize it for search engines using keywords that potential users might search for, like \"best Chrome extensions for productivity\" or \"[task-specific] Chrome extension.\"\n\nStarting small with these approaches can help you gain initial traction and build an engaged user base for your Chrome extension without a large budget!"
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
                        "parent_id": "aaa2f4a2-9516-46d0-8a6d-f616098622a4",
                        "request_id": "8dad5a8ac8e8abc2-CPH",
                        "timestamp_": "absolute",
                        "model_switcher_deny": []
                    },
                    "recipient": "all",
                    "channel": null
                },
                "parent": "aaa2f4a2-9516-46d0-8a6d-f616098622a4",
                "children": []
            }
        },
        "moderation_results": [],
        "current_node": "daad0311-b5b1-45d4-8087-6649ccdbe729",
        "plugin_ids": null,
        "conversation_id": "671fefb3-3fa4-8002-abf6-f774d6c54d9e",
        "conversation_template_id": null,
        "gizmo_id": null,
        "is_archived": false,
        "safe_urls": [],
        "default_model_slug": "auto",
        "conversation_origin": null,
        "voice": null,
        "async_status": null
    }

    setConversationData(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (conversationData) {
      createNodesInOrder(conversationData);
    }
  }, [conversationData]);


  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Prevent native context menu from showing
      event.preventDefault();

      // Calculate position of the context menu. We want to make sure it
      // doesn't get positioned off-screen.
      const pane = ref?.current?.getBoundingClientRect();
      if (pane) {
        setMenu({
          role: node.data?.role || '',
          top: event.clientY < pane.height - 200 && event.clientY ? event.clientY - 48 : false,
          left: event.clientX < pane.width - 200 && event.clientX ? event.clientX : false,
          right: event.clientX >= pane.width - 200 && pane.width - event.clientX,
          bottom:
            event.clientY >= pane.height - 200 && pane.height - event.clientY + 48,
        });
      } 
    },
    [setMenu],
  );

  // Close the context menu if it's open whenever the window is clicked.
  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);


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
        No conversation data available, please refresh the page and try again.
      </div>
    );
  }
 
  return (
    <div className="w-full h-full" style={{ height: '90vh', width: '100%' }}>
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
        {menu && <ContextMenu onClick={onPaneClick} {...menu} />}
      </ReactFlow>
    </div>
  );
}

export default ConversationTree;
