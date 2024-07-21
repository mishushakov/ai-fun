# ai-f

AI-F is an experimental LLM-powered function library. It lets you define the function purpose, the parameters and the output schema and generates and executes the code for you in the background. Think Cursor/GitHub Copilot but as a pluggable library.

Complete example:

```ts
import { z } from 'zod'
import AIFunctionBuilder from 'ai-f'
import NodeExec from 'ai-f/src/backends/node'
import { anthropic } from '@ai-sdk/anthropic'

// Provide a LLM model
const llm = anthropic.chat('claude-3-5-sonnet-20240620')

// Create a new AI Function Builder using Node/exec backend
const backend = new NodeExec()
const ai = new AIFunctionBuilder(llm, backend)

// Define the input parameters and output parameters of the function
const parameters = z.object({ a: z.number(), b: z.number() })
const output = z.number()

// Generate the function
const f = await ai.function('add values provided', parameters, output)

// Call the function and log the result
const result = await f({ a: 1, b: 2 })
console.log(result)
```

Output:

```sh
3
```

## Cache

## Backends

You can create your own backends by implementing the `AIFunctionBackend` class

```ts
export abstract class AIFunctionBackend {
  abstract init(codeContent: CodeContent): Promise<void>
  abstract exec(params: any): Promise<any>
}
```

See [src/backends/node](src/backends/node) for example.
