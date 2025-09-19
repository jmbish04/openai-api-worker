#!/usr/bin/env node

/**
 * Test script to demonstrate Core API service binding
 * This script tests the /ai/consult endpoint from your core API
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

const CORE_API_URL = 'https://core-api.hacolby.workers.dev';
const devVars = loadDevVars();
const CORE_API_KEY = devVars.CORE_WORKER_API_KEY || process.env.CORE_WORKER_API_KEY || 'your-api-key-here';

async function testCoreAPIConsult() {
    console.log('🧪 Testing Core API /ai/consult endpoint...\n');
    
    try {
        const response = await fetch(`${CORE_API_URL}/ai/consult`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CORE_API_KEY,
            },
            body: JSON.stringify({
                query: "What are the best models for text generation?",
                options: {
                    max_tokens: 500,
                    temperature: 0.7
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ Core API Response:');
        console.log('Success:', data.success);
        console.log('Query:', data.data?.query);
        console.log('Reasoning:', data.data?.reasoning);
        console.log('Timestamp:', data.data?.timestamp);
        
        if (data.data?.recommendations) {
            console.log('\n📋 Recommendations:');
            data.data.recommendations.forEach((rec, i) => {
                console.log(`${i + 1}. ${rec.name} - ${rec.description}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error testing Core API:', error.message);
        console.log('\n💡 Make sure to set CORE_WORKER_API_KEY environment variable:');
        console.log('   export CORE_WORKER_API_KEY="your-actual-api-key"');
    }
}

async function testModelsEndpoint() {
    console.log('\n🧪 Testing Core API /ai/models endpoint...\n');
    
    try {
        const response = await fetch(`${CORE_API_URL}/ai/models`, {
            headers: {
                'X-API-Key': CORE_API_KEY,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        console.log('✅ Models Response:');
        
        // Count total models across all providers
        const totalModels = Object.values(data.providers || {}).flat().length;
        console.log('Total models:', totalModels);
        
        // Count providers
        const providers = {};
        Object.entries(data.providers || {}).forEach(([providerName, models]) => {
            providers[providerName] = models.length;
        });
        
        console.log('\n📊 Cloudflare AI Providers:');
        Object.entries(providers).forEach(([provider, count]) => {
            console.log(`  ${provider}: ${count} models`);
        });
        
        console.log('\n🔍 Sample Models:');
        Object.entries(data.providers || {}).slice(0, 3).forEach(([providerName, models]) => {
            console.log(`  ${providerName}:`);
            models.slice(0, 2).forEach(model => {
                console.log(`    ${model.name || model.id}`);
            });
        });
        
    } catch (error) {
        console.error('❌ Error testing models endpoint:', error.message);
    }
}

async function main() {
    console.log('🚀 Core API Service Binding Test\n');
    console.log('Core API URL:', CORE_API_URL);
    console.log('API Key:', CORE_API_KEY ? '✅ Set' : '❌ Missing');
    console.log('─'.repeat(50));
    
    await testCoreAPIConsult();
    await testModelsEndpoint();
    
    console.log('\n✨ Test completed!');
}

main().catch(console.error);
