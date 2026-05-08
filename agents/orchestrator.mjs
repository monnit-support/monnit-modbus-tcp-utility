// agents/orchestrator.mjs

/**
 * All available tools for the multi-agent pipeline.
 */
const allTools = [
  {
    name: 'run_npm',
    description: 'Run npm scripts (test, lint, build).',
    parameters: {
      type: 'OBJECT',
      properties: {
        script: { type: 'STRING', enum: ['test', 'lint', 'build'] },
        args:   { type: 'ARRAY', items: { type: 'STRING' } }
      },
      required: ['script']
    }
  },
  {
    name: 'read_file',
    description: 'Read a UTF-8 file. Crucial for getting the exact context lines needed for a Git Patch.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] }
  },
  {
    name: 'list_files',
    description: 'List files/dirs at path.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] }
  },
  {
    name: 'write_file',
    description: 'ONLY use this for creating brand NEW files. NEVER use this to modify existing files.',
    parameters: {
      type: 'OBJECT',
      properties: { 
        path: { type: 'STRING' }, 
        content: { type: 'STRING' } 
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'apply_patch',
    description: 'Apply modifications to an existing file using a standard Git Unified Diff (.patch) format. This is the ONLY way to edit existing files.',
    parameters: {
      type: 'OBJECT',
      properties: {
        patch_content: { 
            type: 'STRING', 
            description: 'The raw, exact string content of a unified diff. Must start with --- a/filepath\\n+++ b/filepath\\n@@ ...' 
        }
      },
      required: ['patch_content']
    }
  },
  {
    name: 'delete_file',
    description: 'Delete a file at the specified path.',
    parameters: { type: 'OBJECT', properties: { path: { type: 'STRING' } }, required: ['path'] }
  },
  {
    name: 'search_logs',
    description: 'Find lines matching regex in log files.',
    parameters: { type: 'OBJECT', properties: { pattern: { type: 'STRING' }, path: { type: 'STRING' } }, required: ['pattern'] }
  },
  {
    name: 'git_ops',
    description: 'Create branch and commit changes.',
    parameters: { type: 'OBJECT', properties: { branch: { type: 'STRING' }, message: { type: 'STRING' } }, required: ['branch', 'message'] }
  }
];

const PERSONAS = {
  LIBRARIAN: {
    role: 'Reference Librarian',
    instructions: 'GOAL: Map project structure. STRATEGY: Identify "Entry Point" files. Determine if assets live in "public/" or root. Check for redundant files. OUTPUT: Categorized file list.',
    allowedTools: ['read_file', 'list_files', 'search_logs']
  },
  INVESTIGATOR: {
    role: 'Forensic Investigator',
    instructions: 'GOAL: Diagnose bugs. STRATEGY: 1. Verify paths exist. 2. Read the files to understand the logic. OUTPUT: FILES_TO_EDIT: [path1, path2].',
    allowedTools: ['read_file', 'list_files', 'search_logs']
  },
  AUDITOR: {
    role: 'Technical Auditor',
    instructions: 'GOAL: Plan implementation. STRATEGY: Identify the exact line numbers and context needed for a Git Patch. You MUST run read_file to get the exact current state of the code before passing planning data to the Coder.',
    allowedTools: ['read_file', 'list_files', 'search_logs', 'delete_file']
  },
  CODER: {
    role: 'Implementation Coder',
    instructions: `GOAL: Execute task. 
    PRIME DIRECTIVE: You MUST use the 'apply_patch' tool to edit existing files. 
    
    CRITICAL INSTRUCTIONS FOR 'apply_patch':
    1. The 'patch_content' MUST be a valid, strict Unified Diff.
    2. It MUST begin with the file headers:
       --- a/path/to/file.js
       +++ b/path/to/file.js
    3. It MUST include a hunk header: @@ -start,count +start,count @@
    4. You MUST include at least 3 lines of unchanged context before and after your modifications.
    5. Lines to remove must start with '-'. Lines to add must start with '+'. Unchanged context lines must start with a single space ' '.
    6. NEVER use Markdown formatting (like \`\`\`diff) inside the patch_content string. Pass the raw text.
    7. NEVER hallucinate Python scripts to execute commands. ONLY use the provided JSON tools.`,
    allowedTools: ['read_file', 'write_file', 'apply_patch', 'delete_file', 'list_files', 'git_ops'] 
  },
  QA_TESTER: {
    role: 'QA Tester',
    instructions: 'GOAL: Verify integrity. STRATEGY: read_file on edited files. Confirm the Git patch was applied correctly and no syntax errors were introduced.',
    allowedTools: ['read_file', 'run_npm', 'list_files'] 
  }
};

export async function fixBug(bugReport, existingHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY || "";
  // Switched back to Flash to prevent unhandled 404s and fallback loops on accounts without Pro access
  const MODEL_NAME = 'gemini-2.0-flash'; 

  let cleanBugReport = bugReport.split(/# MULTI-AGENT FIX REPORT/i)[0].trim();

  const normalizeHistory = (raw) => {
    if (!raw || raw.length === 0) return [];
    
    const scrubData = (data, limit = 500000) => {
      if (typeof data === 'string') {
        if (data.length > limit) return data.substring(0, limit/2) + `\n[...TRUNCATED BY ORCHESTRATOR FOR CONTEXT SAFETY...]\n` + data.substring(data.length - limit/2);
        return data;
      }
      if (Array.isArray(data)) return data.map(i => scrubData(i, limit));
      if (data && typeof data === 'object') {
        const o = {};
        for (const k in data) o[k] = scrubData(data[k], limit);
        return o;
      }
      return data;
    };
    
    return raw.map(turn => ({
      role: turn.role,
      parts: turn.parts.map(p => {
        if (p.text) return { text: scrubData(p.text) };
        if (p.functionCall) return { functionCall: p.functionCall };
        if (p.functionResponse) return { functionResponse: { name: p.functionResponse.name, response: scrubData(p.functionResponse.response) } };
        return p;
      })
    })).slice(-35); // Keep context window relatively fresh
  };

  let accumulatedKnowledge = "";

  async function runAgent(personaName, taskDescription) {
    const persona = PERSONAS[personaName];
    console.log(`\n[Orchestrator] Activating: ${personaName}`);
    
    const systemInstruction = [
      `ROLE: ${persona.role}`,
      persona.instructions,
      'STRICT SYSTEM RULES:',
      '1. NEVER hallucinate Python code (e.g., `print(default_api.apply_patch...)`). You MUST use the native JSON tool schema.',
      '2. When you are finished, output ONLY a brief text summary of what you did. Do NOT wrap your summary in a JSON object.'
    ].join('\n');

    const filteredTools = allTools.filter(t => persona.allowedTools.includes(t.name));
    const agentPrompt = `TASK: ${taskDescription}\n\nKNOWLEDGE GATHERED: ${accumulatedKnowledge || "None."}\n\nBUG REPORT: ${cleanBugReport}`;

    let localHistory = [{ role: 'user', parts: [{ text: agentPrompt }] }];

    async function callModel(historyToSend, attempt = 0, forceText = false) {
      try {
        const payload = {
            contents: normalizeHistory(historyToSend),
            systemInstruction: { parts: [{ text: systemInstruction }] },
            tools: filteredTools.length > 0 ? [{ functionDeclarations: filteredTools }] : undefined,
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 } 
        };
        
        if (forceText) payload.toolConfig = { functionCallingConfig: { mode: "NONE" } };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const result = await res.json();
        
        if (result.error) {
            if (result.error.code === 429 && attempt < 6) {
                const delay = Math.pow(2, attempt) * 4000;
                await new Promise(r => setTimeout(r, delay));
                return callModel(historyToSend, attempt + 1, forceText);
            }
            throw new Error(result.error.message);
        }
        
        return result;
      } catch (e) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 5000));
          return callModel(historyToSend, attempt + 1, forceText);
        }
        throw e;
      }
    }

    let steps = 0;
    let finalSummary = "";
    while (steps < 15) {
      steps++;
      const res = await callModel(localHistory);
      const content = res.candidates?.[0]?.content;
      if (!content || !content.parts) break;

      const toolCalls = content.parts.filter(p => p.functionCall);
      localHistory.push({ role: 'model', parts: content.parts });

      if (!toolCalls.length) {
        finalSummary = content.parts.map(p => p.text).filter(Boolean).join('\n').trim();
        break;
      }

      const responses = [];
      for (const call of toolCalls) {
        const { name, args } = call.functionCall;
        
        // --- AUTO-FIX: Pre-process arguments to handle LLM naming hallucinations ---
        if (args) {
            if (args.file_path && !args.path) args.path = args.file_path;
            if (args.filePath && !args.path) args.path = args.filePath;
            if (args.patchContent && !args.patch_content) args.patch_content = args.patchContent;
            
            // Auto-fallback for list_files if the AI hallucinates empty arguments
            if (name === 'list_files' && !args.path) args.path = ".";
        }

        console.log(`[${personaName}] -> ${name}()`);
        
        try {
          if ((name === 'read_file' || name === 'write_file' || name === 'delete_file') && !args.path) {
              throw new Error(`MISSING_ARGUMENT: The tool requires a 'path' property.`);
          }

          const { run_npm } = await import('./tools/runNpm.mjs');
          const { read_file, write_file, list_files, delete_file, apply_patch } = await import('./tools/fileIO.mjs');
          const { search_logs } = await import('./tools/logs.mjs');
          const { git_ops } = await import('./tools/gitOps.mjs');
          
          let out;
          if (name === 'read_file') out = await read_file(args);
          else if (name === 'list_files') out = await list_files(args);
          else if (name === 'write_file') out = await write_file(args);
          else if (name === 'run_npm') out = await run_npm(args);
          else if (name === 'search_logs') out = await search_logs(args);
          else if (name === 'git_ops') out = await git_ops(args);
          else if (name === 'delete_file') out = await delete_file(args);
          else if (name === 'apply_patch') out = await apply_patch(args);
          
          responses.push({ functionResponse: { name, response: out } });
        } catch (e) { 
          responses.push({ functionResponse: { name, response: { error: e.message } } }); 
        }
      }
      localHistory.push({ role: 'user', parts: responses });
    }

    if (!finalSummary.trim()) {
      const summaryRes = await callModel(localHistory, 0, true);
      finalSummary = summaryRes.candidates?.[0]?.content?.parts?.[0]?.text || "Agent completed.";
    }
    return finalSummary;
  }

  try {
    const stages = [
        ['LIBRARIAN', 'Verify asset directories.', 'REF'],
        ['INVESTIGATOR', 'Diagnose bug by reading files.', 'DIAGNOSIS'],
        ['AUDITOR', 'Plan the unified diffs needed to fix the bug.', 'PLAN'],
        ['CODER', 'Apply fixes using the apply_patch tool.', 'CODE'],
        ['QA_TESTER', 'Verify integrity of files after patching.', 'QA']
    ];

    for (const [persona, task, label] of stages) {
        const summary = await runAgent(persona, task);
        accumulatedKnowledge += `\n[${label}]:\n${summary}\n`;
    }

    return { summary: `# MULTI-AGENT FIX REPORT\n\n${accumulatedKnowledge}`, history: [] };
  } catch (e) {
    return { summary: `# HALTED: ${e.message}\n\n${accumulatedKnowledge}`, history: [] };
  }
}