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
  const coreApiKey = env.CORE_WORKER_API_KEY;
  
  if (!coreApiKey) {
    console.error("Error: CORE_WORKER_API_KEY not found in .dev.vars");
    console.log("Please ensure CORE_WORKER_API_KEY is set in .dev.vars");
    process.exit(1);
  }

  // Create output array to capture all output
  const output: string[] = [];

  function log(message: string) {
    console.log(message);
    output.push(message);
  }

  try {
    log("Fetching available Cloudflare AI models from Core API...\n");

    const response = await fetch('https://core-api.hacolby.workers.dev/ai/models', {
      headers: {
        'X-API-Key': coreApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Core API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();

    log("=== RAW RESPONSE ===");
    log(JSON.stringify(data, null, 2));
    log("\n=== PARSED MODELS ===");

    if (data.providers && typeof data.providers === 'object') {
      const providers = Object.keys(data.providers);
      const totalModels = Object.values(data.providers).flat().length;
      
      log(`Found ${totalModels} models across ${providers.length} providers:\n`);

      // Collect all capabilities and tasks
      const allCapabilities = new Set<string>();
      const allTasks = new Set<string>();
      const allTags = new Set<string>();

      for (const [providerName, models] of Object.entries(data.providers)) {
        if (Array.isArray(models)) {
          log(`\n=== ${providerName.toUpperCase()} (${models.length} models) ===`);
          
          for (const model of models) {
            log(`${model.name || model.id || 'Unknown'} — ${model.description || 'No description'}`);
            log(`  ID: ${model.id || 'N/A'}`);
            log(`  Source: ${model.source || 'N/A'}`);
            log(`  Created: ${model.created_at || 'N/A'}`);
            
            if (model.task) {
              log(`  Task: ${model.task.name || model.task.id || 'N/A'}`);
              if (model.task.name) allTasks.add(model.task.name);
            }
            
            if (model.tags && Array.isArray(model.tags)) {
              log(`  Tags: ${model.tags.join(', ')}`);
              model.tags.forEach((tag: string) => allTags.add(tag));
            }
            
            if (model.properties && Array.isArray(model.properties)) {
              const capabilities = model.properties
                .filter((prop: any) => prop.property_id && prop.value)
                .map((prop: any) => prop.property_id);
              
              if (capabilities.length > 0) {
                log(`  Capabilities: ${capabilities.join(', ')}`);
                capabilities.forEach((cap: string) => allCapabilities.add(cap));
              }
            }
            
            log("-----");
          }
        }
      }

      // Print unique lists
      if (allTasks.size > 0) {
        log("\n=== UNIQUE TASKS ===");
        const sortedTasks = Array.from(allTasks).sort();
        sortedTasks.forEach((task, index) => {
          log(`${index + 1}. ${task}`);
        });
      }

      if (allCapabilities.size > 0) {
        log("\n=== UNIQUE CAPABILITIES ===");
        const sortedCapabilities = Array.from(allCapabilities).sort();
        sortedCapabilities.forEach((cap, index) => {
          log(`${index + 1}. ${cap}`);
        });
      }

      if (allTags.size > 0) {
        log("\n=== UNIQUE TAGS ===");
        const sortedTags = Array.from(allTags).sort();
        sortedTags.forEach((tag, index) => {
          log(`${index + 1}. ${tag}`);
        });
      }

      // Summary by provider
      log("\n=== PROVIDER SUMMARY ===");
      for (const [providerName, models] of Object.entries(data.providers)) {
        if (Array.isArray(models)) {
          log(`${providerName}: ${models.length} models`);
        }
      }

    } else {
      log("Error: data.providers is not an object or is undefined.");
      log("Response: " + JSON.stringify(data));
    }

    // Save output to file
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'cloudflare-models.txt');
    const jsonFile = join(outputDir, 'cloudflare-models.json');

    // Create directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }

    // Write text output to file
    // writeFileSync(outputFile, output.join('\n'), 'utf-8');
    // console.log(`\nText output saved to: ${outputFile}`);

    // Write JSON output to file
    writeFileSync(jsonFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`JSON output saved to: ${jsonFile}`);
    
  } catch (error) {
    const errorMsg = `Error fetching Cloudflare models: ${error}`;
    console.error(errorMsg);
    output.push(errorMsg);
    
    // Save error to file as well
    const outputDir = join(process.cwd(), 'model_info');
    const outputFile = join(outputDir, 'cloudflare-models.txt');
    
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
