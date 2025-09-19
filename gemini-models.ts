import { GoogleGenAI } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Load environment variables from .dev.vars
function loadDevVars() {
  try {
    const devVarsPath = join(process.cwd(), '.dev.vars');
    const data = readFileSync(devVarsPath, 'utf8');
    const env: Record<string, string> = {};
    
    data.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, value] = trimmedLine.split('=');
        if (key && value) {
          env[key.trim()] = value.trim();
        }
      }
    });
    
    return env;
  } catch (error) {
    console.error('Error loading .dev.vars:', error);
    return {};
  }
}

async function main() {
  const env = loadDevVars();
  const apiKey = env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("Error: GEMINI_API_KEY not found in .dev.vars");
    console.log("Please ensure GEMINI_API_KEY is set in .dev.vars");
    process.exit(1);
  }

  // Create output array to capture all output
  const output: string[] = [];

  function log(message: string) {
    console.log(message);
    output.push(message);
  }

  try {
    const client = new GoogleGenAI({
      apiKey: apiKey,
    });

    log("Fetching available Gemini models...\n");

    // List available models
    const modelsPager = await client.models.list();
    
    log("=== RAW RESPONSE ===");
    log(JSON.stringify(modelsPager, null, 2));
    log("\n=== PARSED MODELS ===");
    
    // Convert pager to array
    const models: any[] = [];
    for await (const model of modelsPager) {
      models.push(model);
    }

    log(`Found ${models.length} models:\n`);
    
    // Collect all supported actions
    const allSupportedActions = new Set<string>();
    
    for (const model of models) {
      log(`${model.name ?? "Unknown"} — ${model.displayName ?? ""}`);
      log(`  Input: ${model.inputTokenLimit ?? "N/A"}, Output: ${model.outputTokenLimit ?? "N/A"}`);
      log(`  Description: ${model.description ?? "No description available."}`);
      
      // Extract supported actions if they exist
      if (model.supportedActions) {
        log(`  Supported Actions: ${model.supportedActions.join(', ')}`);
        model.supportedActions.forEach((action: string) => allSupportedActions.add(action));
      }
      
      log("-----");
    }
    
    // Print unique list of all supported actions
    if (allSupportedActions.size > 0) {
      log("\n=== UNIQUE SUPPORTED ACTIONS ===");
      const sortedActions = Array.from(allSupportedActions).sort();
      sortedActions.forEach((action, index) => {
        log(`${index + 1}. ${action}`);
      });
    } else {
      log("\n=== NO SUPPORTED ACTIONS FOUND ===");
    }

    // Save output to file
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'gemini-models.txt');
    const jsonFile = join(outputDir, 'gemini-models.json');

    // Create directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Write text output to file
    writeFileSync(outputFile, output.join('\n'), 'utf-8');
    console.log(`\nText output saved to: ${outputFile}`);

    // Write JSON output to file
    writeFileSync(jsonFile, JSON.stringify(models, null, 2), 'utf-8');
    console.log(`JSON output saved to: ${jsonFile}`);
    
  } catch (error) {
    const errorMsg = `Error fetching Gemini models: ${error}`;
    console.error(errorMsg);
    output.push(errorMsg);
    
    // Save error to file as well
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'gemini-models.txt');
    
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (e) {
      // Directory might already exist, ignore error
    }
    
    writeFileSync(outputFile, output.join('\n'), 'utf-8');
    process.exit(1);
  }
}

main().catch(console.error);