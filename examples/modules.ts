import { z } from 'zod'
import AIFunctionBuilder from '../src'
import NodeExec from '../src/backends/node'
import { anthropic } from '@ai-sdk/anthropic'

// Provide a LLM model
const llm = anthropic.chat('claude-3-5-sonnet-20240620')

const backend = new NodeExec({
  debug: true,
  packageFile: 'package.json',
  installPackages: true,
})

// Create a new AI Function Executor
const ai = new AIFunctionBuilder(llm, backend, {
  debug: true,
  esModules: true,
  cache: true,
  cacheFile: '.ai-function-executor.json',
})

// Define the input parameters of the function
const parameters = z.object({ a: z.number(), b: z.number() })

// Generate the function
const f = await ai.function('log the values provided using pino', parameters)

// Call the function to log the result
await f({ a: 1, b: 2 })
