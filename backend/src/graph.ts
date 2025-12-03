import {
  StateGraph,
  START,
  END,
  Annotation,
  MemorySaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";

import { tools } from "./tools";
import { prompt } from "./prompt";

// ============================================================================
// STATE DEFINITION (Simplified)
// ============================================================================

interface FileChange {
  path: string;
  action: "create" | "update" | "delete";
}

/**
 * Simplified Lovable Agent State
 * Following "less is more" - only track what's essential
 */
const LovableState = Annotation.Root({
  // Conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),

  // Current user request
  userRequest: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),

  // Is this the first message?
  isFirstMessage: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => true,
  }),

  // Files changed during this session
  changedFiles: Annotation<FileChange[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

type LovableStateType = typeof LovableState.State;

// ============================================================================
// LLM SETUP
// ============================================================================

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",  // Use stable model that works well with tool calling
  temperature: 0.7,
  maxRetries: 2,
  // Relax safety settings to avoid blocking code generation requests
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_ONLY_HIGH",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_ONLY_HIGH",
    },
  ],
});

const llmWithTools = llm.bindTools(tools);

// ============================================================================
// NODE: AGENT
// Single node that handles the entire implementation with tool calling
// This is the ReAct pattern - reason and act in a loop until done
// ============================================================================

async function agentNode(
  state: LovableStateType
): Promise<Partial<LovableStateType>> {
  const { messages, userRequest, isFirstMessage, changedFiles } = state;

  // Build context about current state
  const contextInfo =
    changedFiles.length > 0
      ? `\n\nFILES CHANGED SO FAR:\n${changedFiles
          .map((f) => `- ${f.action}: ${f.path}`)
          .join("\n")}`
      : "";

  const systemPrompt = `${prompt}

PROJECT SETUP:
- This is a Vite + React + TailwindCSS + shadcn/ui project
- The project is already set up with all dependencies installed
- Files are located in /home/user/app/
- Use relative paths like 'src/App.tsx' when using tools
${
  isFirstMessage
    ? "\nThis is the FIRST message - create the initial application structure."
    : ""
}
${contextInfo}

IMPORTANT:
- Use the tools to create/update files as needed
- When you're done implementing, respond with a brief summary (no more tool calls)
- Keep responses concise
- Do NOT create unnecessary files - focus on what the user asked for`;

  console.log("[agentNode] Invoking LLM with", messages.length, "messages");
  console.log("[agentNode] System prompt length:", systemPrompt.length);
  console.log("[agentNode] isFirstMessage:", isFirstMessage);

  try {
    const response = await llmWithTools.invoke([
      new SystemMessage(systemPrompt),
      ...messages,
    ]);

    console.log("[agentNode] LLM Response received");
    console.log("[agentNode] Response type:", response.constructor.name);
    console.log(
      "[agentNode] Has tool_calls:",
      !!(response.tool_calls && response.tool_calls.length > 0)
    );
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(
        "[agentNode] Tool calls:",
        response.tool_calls.map((tc) => tc.name)
      );
    }
    console.log(
      "[agentNode] Content preview:",
      typeof response.content === "string"
        ? response.content.substring(0, 200) + "..."
        : "non-string content"
    );

    return {
      messages: [response],
    };
  } catch (error) {
    // Handle Gemini safety filter or other API errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[agentNode] LLM invocation error:", errorMessage);
    console.error("[agentNode] Full error:", error);

    // Check if it's a safety filter issue (candidateContent.parts undefined)
    if (
      errorMessage.includes("candidateContent") ||
      errorMessage.includes("parts")
    ) {
      console.error(
        "[agentNode] Detected safety filter / candidateContent error"
      );
      return {
        messages: [
          new AIMessage(
            "I apologize, but I encountered an issue processing your request. Please try rephrasing your request or breaking it into smaller steps."
          ),
        ],
      };
    }

    // For other errors, return a generic error message
    return {
      messages: [
        new AIMessage(
          `I encountered an error: ${errorMessage}. Please try again.`
        ),
      ],
    };
  }
}

// ============================================================================
// NODE: TOOLS
// Executes tool calls and tracks file changes
// ============================================================================

const toolNode = new ToolNode(tools);

async function toolsNode(
  state: LovableStateType
): Promise<Partial<LovableStateType>> {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;

  console.log("[toolsNode] Processing tool calls");
  console.log(
    "[toolsNode] Last message tool_calls:",
    lastMessage.tool_calls?.length || 0
  );

  if (!lastMessage.tool_calls?.length) {
    console.log("[toolsNode] No tool calls found, returning empty");
    return {};
  }

  console.log(
    "[toolsNode] Executing tools:",
    lastMessage.tool_calls.map((tc) => tc.name)
  );

  // Execute tools
  try {
    const result = await toolNode.invoke({ messages: [lastMessage] });
    console.log("[toolsNode] Tools executed successfully");
    console.log("[toolsNode] Result messages:", result.messages?.length || 0);

    // Track file changes
    const newChanges: FileChange[] = [];
    for (const tc of lastMessage.tool_calls) {
      if (tc.name === "create_file") {
        const args = tc.args as { location: string };
        newChanges.push({ path: args.location, action: "create" });
      } else if (tc.name === "update_file") {
        const args = tc.args as { location: string };
        newChanges.push({ path: args.location, action: "update" });
      } else if (tc.name === "delete_file") {
        const args = tc.args as { location: string };
        newChanges.push({ path: args.location, action: "delete" });
      } else if (tc.name === "write_multiple_files") {
        const args = tc.args as { files: { path: string }[] };
        for (const f of args.files) {
          newChanges.push({ path: f.path, action: "create" });
        }
      }
    }

    return {
      messages: result.messages,
      changedFiles: newChanges,
    };
  } catch (toolError) {
    console.error("[toolsNode] Error executing tools:", toolError);
    throw toolError;
  }
}

// ============================================================================
// ROUTING: Simple check - has tool calls or done?
// ============================================================================

function shouldContinue(state: LovableStateType): "tools" | "end" {
  const lastMessage = state.messages[state.messages.length - 1];

  // If the last message has tool calls, execute them
  if (
    lastMessage &&
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  // Otherwise, we're done
  return "end";
}

// ============================================================================
// GRAPH CONSTRUCTION
// Simple ReAct loop: agent -> tools -> agent -> ... -> end
// ============================================================================

function buildGraph() {
  const workflow = new StateGraph(LovableState)
    .addNode("agent", agentNode)
    .addNode("tools", toolsNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      end: END,
    })
    .addEdge("tools", "agent");

  const checkpointer = new MemorySaver();
  return workflow.compile({ checkpointer });
}

export const graph = buildGraph();

// ============================================================================
// STREAMING EVENT TYPES
// ============================================================================

export interface StreamEvent {
  type:
    | "thinking"
    | "tool_call"
    | "tool_result"
    | "message"
    | "file_change"
    | "done"
    | "error";
  data: unknown;
  timestamp: string;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Start a new conversation or continue existing one
 */
export async function chat(
  userMessage: string,
  threadId: string,
  isFirstMessage: boolean = true
) {
  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 50, // Allow more iterations for complex tasks
  };

  const result = await graph.invoke(
    {
      messages: [new HumanMessage(userMessage)],
      userRequest: userMessage,
      isFirstMessage,
    },
    config
  );

  return result;
}

/**
 * Stream chat for real-time updates with detailed reasoning events
 */
export async function* streamChat(
  userMessage: string,
  threadId: string,
  isFirstMessage: boolean = true
): AsyncGenerator<StreamEvent> {
  const config = {
    configurable: { thread_id: threadId },
    recursionLimit: 50,
  };

  const now = () => new Date().toISOString();

  // Emit initial thinking event
  yield {
    type: "thinking",
    data: { step: "analyzing", message: "Analyzing your request..." },
    timestamp: now(),
  };

  let stepCount = 0;
  const allChangedFiles: FileChange[] = [];

  try {
    const stream = await graph.stream(
      {
        messages: [new HumanMessage(userMessage)],
        userRequest: userMessage,
        isFirstMessage,
      },
      { ...config, streamMode: "updates" }
    );

    for await (const event of stream) {
      stepCount++;

      // Process agent node events
      if ("agent" in event) {
        const agentState = event.agent as Partial<LovableStateType>;
        const messages = agentState.messages || [];

        for (const msg of messages) {
          if (msg instanceof AIMessage || (msg && "tool_calls" in msg)) {
            const aiMsg = msg as AIMessage;

            // Check for tool calls
            if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
              yield {
                type: "thinking",
                data: {
                  step: "planning",
                  message: `Planning ${aiMsg.tool_calls.length} action(s)...`,
                },
                timestamp: now(),
              };

              for (const tc of aiMsg.tool_calls) {
                yield {
                  type: "tool_call",
                  data: {
                    name: tc.name,
                    args: tc.args,
                    description: getToolDescription(tc.name, tc.args),
                  },
                  timestamp: now(),
                };
              }
            } else if (typeof aiMsg.content === "string" && aiMsg.content) {
              // Final message from agent
              yield {
                type: "message",
                data: { content: aiMsg.content },
                timestamp: now(),
              };
            }
          }
        }
      }

      // Process tools node events
      if ("tools" in event) {
        const toolsState = event.tools as Partial<LovableStateType>;

        // Report file changes
        if (toolsState.changedFiles && toolsState.changedFiles.length > 0) {
          for (const change of toolsState.changedFiles) {
            allChangedFiles.push(change);
            yield {
              type: "file_change",
              data: change,
              timestamp: now(),
            };
          }
        }

        // Report tool results
        const messages = toolsState.messages || [];
        for (const msg of messages) {
          if (msg && "name" in msg) {
            yield {
              type: "tool_result",
              data: {
                name: (msg as { name: string }).name,
                success: true,
              },
              timestamp: now(),
            };
          }
        }
      }
    }

    // Emit done event with summary
    yield {
      type: "done",
      data: {
        totalSteps: stepCount,
        changedFiles: allChangedFiles,
      },
      timestamp: now(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Stream chat error:", errorMessage);

    // Emit error event
    yield {
      type: "error",
      data: {
        message:
          errorMessage.includes("candidateContent") ||
          errorMessage.includes("parts")
            ? "I apologize, but I encountered an issue processing your request. Please try rephrasing your request or breaking it into smaller steps."
            : `An error occurred: ${errorMessage}`,
      },
      timestamp: now(),
    };
  }
}

/**
 * Get a human-readable description of a tool call
 */
function getToolDescription(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case "create_file":
      return `Creating file: ${args.location}`;
    case "update_file":
      return `Updating file: ${args.location}`;
    case "delete_file":
      return `Deleting file: ${args.location}`;
    case "read_file":
      return `Reading file: ${args.location}`;
    case "list_directory":
      return `Listing directory: ${args.path || "."}`;
    case "search_files":
      return `Searching for: ${args.query}`;
    case "execute_command":
      return `Running command: ${args.command}`;
    case "write_multiple_files":
      const files = args.files as { path: string }[] | undefined;
      return `Creating ${files?.length || 0} files`;
    default:
      return `Executing: ${name}`;
  }
}

export type { LovableStateType, FileChange };
