import { z } from 'zod'
import AIFunctionExecutor from '../src'
import { anthropic } from '@ai-sdk/anthropic'

// Provide a LLM model
const llm = anthropic.chat('claude-3-5-sonnet-20240620')

// Create a new AI Function Executor
const ai = new AIFunctionExecutor(llm, {
  debug: true,
  packageFile: 'package.json',
  installPackages: true,
})

// Define the input parameters of the function
const parameters = z.object({ a: z.number(), b: z.number() })

// Generate the function
const f = await ai.function('log the values provided using pino', parameters)

// Call the function to log the result
await f({ a: 1, b: 2 })
