import OpenAI from 'openai';
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
  const apiKey = env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY not found in .dev.vars");
    console.log("Please ensure OPENAI_API_KEY is set in .dev.vars");
    process.exit(1);
  }

  // Create output array to capture all output
  const output: string[] = [];

  function log(message: string) {
    console.log(message);
    output.push(message);
  }

  try {
    const openai = new OpenAI({
      apiKey: apiKey,
    });

    log("Fetching available OpenAI models...\n");

    const models = await openai.models.list();
    
    log("=== RAW RESPONSE ===");
    log(JSON.stringify(models, null, 2));
    log("\n=== PARSED MODELS ===");

    log(`Found ${models.data.length} models:\n`);
    
    // Collect all chat models
    const chatModels: any[] = [];
    
    for (const model of models.data) {
      log(`${model.id} — ${model.owned_by || 'Unknown'}`);
      log(`  Created: ${new Date(model.created * 1000).toISOString()}`);
      log(`  Object: ${model.object}`);
      
      // Check if it's a chat model using the same logic as our script
      const isChatModel = model.id.includes('gpt') || model.id.includes('o1');
      log(`  Chat Model: ${isChatModel ? 'Yes' : 'No'}`);
      
      if (isChatModel) {
        chatModels.push(model);
      }
      
      log("-----");
    }
    
    // Print chat models summary
    if (chatModels.length > 0) {
      log("\n=== CHAT MODELS SUMMARY ===");
      log(`Found ${chatModels.length} chat models:`);
      chatModels.forEach((model, index) => {
        log(`${index + 1}. ${model.id} (${model.owned_by || 'Unknown'})`);
      });
    } else {
      log("\n=== NO CHAT MODELS FOUND ===");
    }

    // Save output to file
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'openai-models.txt');
    const jsonFile = join(outputDir, 'openai-models.json');

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
    writeFileSync(jsonFile, JSON.stringify(models.data, null, 2), 'utf-8');
    console.log(`JSON output saved to: ${jsonFile}`);
    
  } catch (error) {
    const errorMsg = `Error fetching OpenAI models: ${error}`;
    console.error(errorMsg);
    output.push(errorMsg);
    
    // Save error to file as well
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'openai-models.txt');
    
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
