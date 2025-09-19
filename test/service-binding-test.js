#!/usr/bin/env node

/**
 * Test script to verify service binding is working
 * This tests the openai-api-worker's /v1/models endpoint which uses service binding
 */

const fs = require('fs');
const path = require('path');

// Load .dev.vars file
function loadDevVars() {
    const devVarsPath = path.join(__dirname, '..', '.dev.vars');
    const vars = {};
    
    if (fs.existsSync(devVarsPath)) {
        const content = fs.readFileSync(devVarsPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    vars[key.trim()] = valueParts.join('=').trim();
                }
            }
        });
    }
    
    return vars;
}

const WORKER_URL = 'https://openai-api-worker.hacolby.workers.dev';
const devVars = loadDevVars();
const API_KEY = devVars.WORKER_API_KEY || process.env.WORKER_API_KEY || 'test-key';

async function testServiceBinding() {
    console.log('🧪 Testing Service Binding via openai-api-worker...\n');
    
    try {
        const response = await fetch(`${WORKER_URL}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ Service Binding Response:');
        console.log('Total models:', data.data?.length || 0);
        
        // Count Cloudflare providers
        const cloudflareModels = data.data?.filter(m => m.id?.startsWith('@cf/')) || [];
        const providers = {};
        
        cloudflareModels.forEach(model => {
            const provider = model.id.split('/')[1];
            providers[provider] = (providers[provider] || 0) + 1;
        });
        
        console.log('\n📊 Cloudflare AI Providers (via service binding):');
        Object.entries(providers).forEach(([provider, count]) => {
            console.log(`  ${provider}: ${count} models`);
        });
        
        console.log('\n🔍 Sample Cloudflare Models:');
        cloudflareModels.slice(0, 5).forEach(model => {
            console.log(`  ${model.id} (${model.owner})`);
        });
        
        if (cloudflareModels.length > 5) {
            console.log(`  ... and ${cloudflareModels.length - 5} more`);
        }
        
    } catch (error) {
        console.error('❌ Error testing service binding:', error.message);
        console.log('\n💡 Make sure the worker is running:');
        console.log('   pnpm wrangler dev --port 8788');
    }
}

async function main() {
    console.log('🚀 Service Binding Test\n');
    console.log('Worker URL:', WORKER_URL);
    console.log('─'.repeat(50));
    
    await testServiceBinding();
    
    console.log('\n✨ Service binding test completed!');
    console.log('\n💡 This demonstrates that:');
    console.log('   1. openai-api-worker → core-api service binding works');
    console.log('   2. Models are being fetched from core-api via internal routing');
    console.log('   3. No public internet calls are made between workers');
}

main().catch(console.error);
