import { z } from 'zod'
import AIFunctionExecutor from '../src'
import { anthropic } from '@ai-sdk/anthropic'

// Provide a LLM model
const llm = anthropic.chat('claude-3-5-sonnet-20240620')

// Create a new AI Function Executor
const ai = new AIFunctionExecutor(llm)

// Define the input parameters and output parameters of the function
const parameters = z.object({ a: z.number(), b: z.number() })
const output = z.number()

// Generate the function
const f = await ai.function('add values provided', parameters, output)

// Call the function and log the result
// await f({ a: 1, b: 2 })
// console.log(result)

// Call the function 10 times
for (let i = 0; i < 10; i++) {
  const result = await f({ a: i, b: i + 1 })
  console.log(result)
}
