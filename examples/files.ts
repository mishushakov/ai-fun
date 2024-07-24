import { z } from 'zod'
import AIFunctionBuilder from '../src'
import NodeExec from '../src/backends/node'
import { anthropic } from '@ai-sdk/anthropic'

// Provide a LLM model
const llm = anthropic.chat('claude-3-5-sonnet-20240620')

// Create a new AI Function Executor
const backend = new NodeExec()
const ai = new AIFunctionBuilder(llm, backend)

// Define the input parameters and output parameters of the function
const parameters = z.string()
const output = z.string()

// Generate the function
const f = await ai.function('read the contents of a file', parameters, output)

// Call the function and log the result
const result = await f('./examples/file2.txt')
console.log(result)
