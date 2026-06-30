'use strict';
// Task definitions for airblander benchmark.
// Each task: prompt, expected output filename, deprecated patterns from watchlist.json.
// check(workdir) returns { deprecated: bool, patterns: string[] } — no API needed.

const { readdirSync, readFileSync, existsSync } = require('fs');
const { join } = require('path');

function grepFile(filePath, patterns) {
  if (!existsSync(filePath)) return [];
  const content = readFileSync(filePath, 'utf8');
  return patterns.filter(p => new RegExp(p, 'i').test(content));
}

function check(workdir, task) {
  const filePath = join(workdir, task.outputFile);
  const found = grepFile(filePath, task.deprecatedPatterns);
  return { deprecated: found.length > 0, patterns: found, fileWritten: existsSync(filePath) };
}

const TASKS = [
  {
    id: 'twilio-sms',
    sdk: 'twilio',
    prompt: 'Write a Node.js script called twilio-sms.js that sends an SMS message using the twilio npm package. Use environment variables TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. Send to +15005550006 from +15005550001.',
    outputFile: 'twilio-sms.js',
    // Removed in twilio-node v4: RestClient constructor
    deprecatedPatterns: ['Twilio\\.RestClient\\(', 'RestClient\\('],
  },
  {
    id: 'stripe-charge',
    sdk: 'stripe',
    prompt: 'Write a Node.js script called stripe-charge.js that collects a $20 payment using the stripe npm package. Use PaymentIntents, not the old Charges API.',
    outputFile: 'stripe-charge.js',
    // Charges and Sources APIs deprecated in favour of PaymentIntents / PaymentMethods
    deprecatedPatterns: ['stripe\\.charges\\.create', 'charges\\.create', '\\.sources\\.create', 'stripe\\.orders\\.create'],
  },
  {
    id: 'openai-chat',
    sdk: 'openai',
    prompt: 'Write a Python script called openai_chat.py that sends a user message "Hello" to GPT-4o using the openai package and prints the reply.',
    outputFile: 'openai_chat.py',
    // Pre-v1.0 class-based API removed in openai-python v1.0
    deprecatedPatterns: ['openai\\.ChatCompletion\\.create', 'openai\\.Completion\\.create', 'openai\\.api_key\\s*=', 'text-davinci-003', 'gpt-3\\.5-turbo-0301'],
  },
  {
    id: 'anthropic-message',
    sdk: 'anthropic',
    prompt: 'Write a Node.js script called anthropic-message.js that sends a message "Hello" to claude-sonnet-4-6 using the anthropic npm package and prints the response text.',
    outputFile: 'anthropic-message.js',
    // Completions API deprecated; claude-2 family retired; claude-instant retired Jan 2025
    deprecatedPatterns: ['\\.completions\\.create\\(', '"claude-2', "'claude-2", 'claude-instant-', 'claude-v1', 'claude-3-opus-20240229', 'claude-3-5-sonnet-20240620'],
  },
  {
    id: 'gemini-generate',
    sdk: 'google-genai',
    prompt: 'Write a Node.js script called gemini-generate.js that generates a short poem using the @google/generative-ai package. Use the gemini-2.0-flash model.',
    outputFile: 'gemini-generate.js',
    // generateText removed in @google/generative-ai v0.2+; gemini-pro (1.0) deprecated
    deprecatedPatterns: ['\\.generateText\\(', 'gemini-pro(?!-vision|-1\\.5|-2\\.0)', 'chat-bison', 'text-bison'],
  },
  {
    id: 'bedrock-invoke',
    sdk: 'aws-bedrock',
    prompt: 'Write a Python script called bedrock_invoke.py that sends a message to Claude Sonnet on AWS Bedrock using boto3. Use the converse() API. Use model ID anthropic.claude-sonnet-4-5-v1:0.',
    outputFile: 'bedrock_invoke.py',
    // Retired model IDs on Bedrock
    deprecatedPatterns: ['anthropic\\.claude-v2', 'anthropic\\.claude-instant', 'amazon\\.titan-text-express'],
  },
  {
    id: 'livekit-room',
    sdk: 'livekit',
    prompt: 'Write a Node.js script called livekit-room.js that creates a LiveKit room named "test-room" using the livekit-server-sdk package. Use environment variable LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL.',
    outputFile: 'livekit-room.js',
    // Direct RoomServiceClient instantiation API changed in livekit-server-sdk v2
    deprecatedPatterns: ['new\\s+RoomServiceClient\\('],
  },
  {
    id: 'resend-email',
    sdk: 'resend',
    prompt: 'Write a Node.js script called resend-email.js that sends a transactional welcome email using the Resend npm package (resend). Use environment variable RESEND_API_KEY.',
    outputFile: 'resend-email.js',
    // Unknown SDK — no deprecated patterns; this task tests the v2 resolution path
    deprecatedPatterns: [],
    notes: 'Tests v2: resolve.js should detect "Resend" as an unknown SDK and gate the write.',
  },
  {
    id: 'clerk-auth',
    sdk: 'clerk',
    prompt: 'Write a Node.js Express middleware called clerk-auth.js that protects a route using Clerk authentication. Use the @clerk/clerk-sdk-node package.',
    outputFile: 'clerk-auth.js',
    // Unknown SDK — tests v2 resolution path
    deprecatedPatterns: [],
    notes: 'Tests v2: resolve.js should detect "Clerk" as an unknown SDK and gate the write.',
  },
];

TASKS.check = (workdir, task) => check(workdir, task);

module.exports = TASKS;
