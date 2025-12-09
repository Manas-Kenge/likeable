import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { Sandbox } from "e2b";
import type { RetryPolicy } from "@langchain/langgraph";
import { prompt as systemPrompt, planPrompt, executePrompt } from "./prompt";

/** Recursively read all source files from sandbox */
async function readSandboxFiles(sandbox: Sandbox, dir: string = "/home/user/app/src"): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  
  try {
    const entries = await sandbox.files.list(dir);
    
    for (const entry of entries) {
      const fullPath = `${dir}/${entry.name}`;
      
      if (entry.type === "dir") {
        // Recursively read subdirectories, but skip node_modules and other non-essential dirs
        if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
          const subFiles = await readSandboxFiles(sandbox, fullPath);
          Object.assign(files, subFiles);
        }
      } else if (entry.type === "file") {
        // Only read source files we care about
        if (entry.name.match(/\.(tsx?|css|json)$/) && !entry.name.includes(".d.ts")) {
          try {
            const content = await sandbox.files.read(fullPath);
            // Store with relative path from app root
            const relativePath = fullPath.replace("/home/user/app/", "");
            files[relativePath] = content;
          } catch (err) {
            console.warn(`[readSandboxFiles] Failed to read ${fullPath}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[readSandboxFiles] Failed to list ${dir}:`, err);
  }
  
  return files;
}

// State with planning
const State = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => curr.concat(update),
    default: () => [],
  }),
  plan: Annotation<string[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),
  currentStep: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
  files: Annotation<Record<string, string>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  originalRequest: Annotation<string>({
    reducer: (_, update) => update,
    default: () => "",
  }),
});

type StateType = typeof State.State;

const parseJSON = (text: string) => {
  // First try to extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {}
  }

  // Fallback to raw JSON extraction (objects or arrays)
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  try {
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
};

export function createPlanningAgent(sandbox: Sandbox) {
  const llm = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0,
    maxRetries: 2,
  });

  const retryPolicy: RetryPolicy = {
    maxAttempts: 3,
    initialInterval: 1.0,
    backoffFactor: 2.0,
  };

  // Node 1: Create a plan
  async function planNode(state: StateType, config?: any): Promise<Partial<StateType>> {
    console.log(`[PlanNode] Creating plan for user message`);

    // Extract original request from first human message
    const originalRequest = state.messages.find(m => m._getType() === 'human')?.content as string || "";
    console.log(`[PlanNode] Original request: ${originalRequest.substring(0, 100)}...`);

    // Read existing files from sandbox to provide context
    console.log(`[PlanNode] Reading existing files from sandbox...`);
    const existingFiles = await readSandboxFiles(sandbox);
    const fileList = Object.keys(existingFiles);
    console.log(`[PlanNode] Found ${fileList.length} existing files:`, fileList);

    // Build context about existing files for the LLM
    const existingFilesContext = fileList.length > 0 
      ? `\n\nExisting files in the project:\n${fileList.map(f => `- ${f}`).join("\n")}`
      : "";

    const response = await llm.invoke([
      new SystemMessage(`${systemPrompt}\n\n${planPrompt}${existingFilesContext}`),
      ...state.messages,
    ]);

    console.log(`[PlanNode] LLM response:`, response.content);

    const plan = parseJSON(response.content as string) || [];
    console.log(`[PlanNode] Parsed plan with ${plan.length} steps:`, plan);

    config?.writer?.({ type: "plan", data: plan });

    return {
      plan,
      currentStep: 0,
      originalRequest,
      files: existingFiles, // Initialize state with existing files
      messages: [new AIMessage(`Plan: ${plan.length} steps`)],
    };
  }

  // Node 2: Execute current step
  async function executeNode(state: StateType, config?: any): Promise<Partial<StateType>> {
    const currentStepDesc = state.plan[state.currentStep];
    if (!currentStepDesc) return { currentStep: state.currentStep + 1 };

    console.log(`[ExecuteNode] Step ${state.currentStep + 1}: ${currentStepDesc}`);
    config?.writer?.({ type: "step", data: { num: state.currentStep + 1, description: currentStepDesc } });

    // Build file context - include contents of relevant files
    const fileEntries = Object.entries(state.files);
    let fileContext = "";
    
    if (fileEntries.length > 0) {
      // Include file contents for context (limit to avoid token overflow)
      const relevantFiles = fileEntries.slice(0, 15); // Limit to 15 most relevant files
      fileContext = "\n\nExisting files and their contents:\n" + relevantFiles.map(([path, content]) => {
        // Truncate very large files
        const truncatedContent = content.length > 3000 
          ? content.substring(0, 3000) + "\n... (truncated)"
          : content;
        return `--- ${path} ---\n${truncatedContent}`;
      }).join("\n\n");
    }

    const response = await llm.invoke([
      new SystemMessage(`${systemPrompt}\n\n${executePrompt}`),
      new HumanMessage(`Execute this step: "${currentStepDesc}"${fileContext}`),
    ]);

    console.log(`[ExecuteNode] LLM response:`, response.content);

    const ops = parseJSON(response.content as string);
    console.log(`[ExecuteNode] Parsed operations:`, JSON.stringify(ops, null, 2));

    const updates: Record<string, string> = {};

    if (!ops || !ops.operations || ops.operations.length === 0) {
      console.warn(`[ExecuteNode] No operations found in LLM response`);
      return {
        currentStep: state.currentStep + 1,
        messages: [new AIMessage(`Step completed (no file operations): ${currentStepDesc}`)],
      };
    }

    try {
      for (const op of ops.operations) {
        console.log(`[ExecuteNode] Processing operation:`, op.type, op.path);

        if (op.type === "write_file") {
          const fullPath = `/home/user/app/${op.path}`;
          console.log(`[ExecuteNode] Writing file to: ${fullPath}`);
          console.log(`[ExecuteNode] Content length: ${(op.content || '').length} bytes`);

          await sandbox.files.write(fullPath, op.content || '');
          updates[op.path] = op.content || '';

          console.log(`[ExecuteNode] Successfully wrote: ${op.path}`);
          config?.writer?.({ type: "file_change", data: { path: op.path, action: "write" } });
        } else if (op.type === "run_command") {
          console.log(`[ExecuteNode] Running command: ${op.command}`);
          await sandbox.commands.run(op.command, {
            onStdout: (data: any) => {
              console.log(`[ExecuteNode] stdout:`, data.line || data);
              config?.writer?.({ type: "stdout", data: data.line || data });
            },
            onStderr: (data: any) => {
              console.log(`[ExecuteNode] stderr:`, data.line || data);
              config?.writer?.({ type: "stderr", data: data.line || data });
            },
          });
        }
      }

      console.log(`[ExecuteNode] Completed with ${Object.keys(updates).length} file updates`);
    } catch (error) {
      console.error(`[ExecuteNode] Error during execution:`, error);
      config?.writer?.({ type: "error", data: { step: currentStepDesc, error: String(error) } });
    }

    return {
      files: updates,
      currentStep: state.currentStep + 1,
      messages: [new AIMessage(`Done: ${currentStepDesc}`)],
    };
  }

  // Node 3: Reflect on progress
  async function reflectNode(state: StateType): Promise<Partial<StateType>> {
    console.log(`[ReflectNode] Reviewing progress: ${state.currentStep}/${state.plan.length} steps completed`);
    console.log(`[ReflectNode] Files modified:`, Object.keys(state.files));

    // Auto-complete if all steps are done
    if (state.currentStep >= state.plan.length) {
      console.log(`[ReflectNode] All steps completed, marking as done`);
      return {
        messages: [new AIMessage(JSON.stringify({ done: true, message: "All tasks completed successfully" }))]
      };
    }

    const response = await llm.invoke([
      new SystemMessage(`Review progress:
- Completed ${state.currentStep}/${state.plan.length} steps
- Files modified: ${Object.keys(state.files).join(", ") || "none"}

If all steps are complete, respond: {"done": true, "message": "All tasks completed"}
If more work needed, respond: {"done": false, "message": "reason why"}

Respond with ONLY valid JSON, no markdown.`),
      ...state.messages,
    ]);

    console.log(`[ReflectNode] LLM response:`, response.content);
    return { messages: [response] };
  }

  // Build and return compiled graph
  const workflow = new StateGraph(State)
    .addNode("plan_node", planNode)
    .addNode("execute_node", executeNode, { retryPolicy })
    .addNode("reflect_node", reflectNode)
    .addEdge(START, "plan_node")
    .addEdge("plan_node", "execute_node")
    .addConditionalEdges("execute_node", (s) => {
      // Safety: max 20 steps to prevent infinite loops
      if (s.currentStep >= 20) {
        console.warn(`[Graph] Max steps (20) reached, forcing completion`);
        return "reflect_node";
      }
      return s.currentStep >= s.plan.length ? "reflect_node" : "execute_node";
    }, { execute_node: "execute_node", reflect_node: "reflect_node" })
    .addConditionalEdges("reflect_node", (s) => {
      const lastMsg = s.messages[s.messages.length - 1]?.content as string || "";
      const done = lastMsg.includes('"done": true') || lastMsg.includes('"done":true');
      console.log(`[Graph] Reflect routing: done=${done}`);
      return done ? END : "execute_node";
    }, { execute_node: "execute_node", [END]: END });

  return workflow.compile();
  }


// Non-streaming chat - extract file changes from final state
export async function chat(message: string, projectId: string, isFirstMessage: boolean, sandbox: Sandbox) {
  const graph = createPlanningAgent(sandbox);
  const result = await graph.invoke({ messages: [new HumanMessage(message)] });
  return {
    messages: result.messages || [],
    changedFiles: Object.entries(result.files || {}).map(([path, content]) => ({
      path,
      action: "update" as const,
      content: content as string,
    })),
  };
}

// Streaming chat using state updates from graph execution
export async function* streamChat(message: string, projectId: string, isFirstMessage: boolean, sandbox: Sandbox) {
  const graph = createPlanningAgent(sandbox);

  try {
    console.log(`[StreamChat] Starting stream for project ${projectId}`);
    const stream = await graph.stream(
      { messages: [new HumanMessage(message)] },
      { configurable: {} }
    );

    for await (const event of stream) {
      console.log(`[StreamChat] Event keys:`, Object.keys(event));

      // event is an object like { plan_node: {...}, execute_node: {...}, etc }
      if (event.plan_node?.plan) {
        console.log(`[StreamChat] Yielding plan with ${event.plan_node.plan.length} steps`);
        yield { type: "plan", data: event.plan_node.plan };
      }

      if (event.execute_node?.currentStep !== undefined) {
        console.log(`[StreamChat] Yielding step ${event.execute_node.currentStep}`);
        yield { type: "step", data: { num: event.execute_node.currentStep } };
      }

      if (event.execute_node?.files && Object.keys(event.execute_node.files).length > 0) {
        const fileList = Object.keys(event.execute_node.files);
        console.log(`[StreamChat] Yielding ${fileList.length} files:`, fileList);
        yield { type: "files", data: fileList };
      }

      if (event.reflect_node) {
        console.log(`[StreamChat] Reflect node completed`);
      }
    }

    console.log(`[StreamChat] Stream completed`);
    yield { type: "done" };
  } catch (error) {
    console.error(`[StreamChat] Error:`, error);
    yield { type: "error", data: { message: error instanceof Error ? error.message : String(error) } };
  }
}