import { LanguageModelV1 } from '@ai-sdk/provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import superjson from 'superjson'
import fs from 'fs/promises'

type AIFunctionExecutorOptions = {
  packageFile?: string
  debug?: boolean
  installPackages?: boolean
  esModules?: boolean
  cache?: boolean
  cacheFile?: string
}

export type CodeContent = {
  code: string
  npmModules: string[]
}

type CacheContent = {
  [key: string]: CodeContent
}

async function generateCode(
  model: LanguageModelV1,
  description: string,
  parameters: z.AnyZodObject,
  output: z.ZodTypeAny,
  options: AIFunctionExecutorOptions
) {
  const parametersSchema = zodToJsonSchema(parameters || z.null())
  const outputSchema = zodToJsonSchema(output || z.null())

  const systemSchema = z.object({
    code: z.string(),
    npmModules: z.array(z.string()),
  })

  const { object } = await generateObject({
    model: model,
    system: `Provide a Node.js function that according to the given function signature.
    No comments, external packages are supported. Use function syntax. Your can only respond with code. ${
      options.esModules ? 'Use ES modules syntax.' : ''
    }`,
    prompt: `
    // ${description}
    f(params: ${superjson.stringify(parametersSchema)}): ${JSON.stringify(
      outputSchema
    )}
    `,
    schema: systemSchema,
  })

  // mock
  // const object = {
  //   code: `function f(params) { return params }`,
  //   npmModules: ['pino'],
  // }

  return object
}

export abstract class ExecutorBackend {
  abstract exec(codeContent: CodeContent, params: any)
}

export default class AIFunctionExecutor {
  constructor(
    private model: LanguageModelV1,
    private backend: ExecutorBackend,
    private options: AIFunctionExecutorOptions = {
      debug: false,
      esModules: false,
      cache: true,
      cacheFile: '.ai-function-executor.json',
    }
  ) {
    this.model = model
    this.options = options
    this.backend = backend
  }

  async function<T extends z.AnyZodObject, O extends z.ZodTypeAny>(
    description: string,
    parameters?: T,
    output?: O
  ) {
    let codeContent

    if (this.options.cache) {
      try {
        const cache = await fs.readFile(this.options.cacheFile, 'utf-8')
        const cacheObject = JSON.parse(cache)
        codeContent = cacheObject[description]
      } catch (e) {
        // console.log('cache not found')
      }
    }

    if (!codeContent) {
      codeContent = await generateCode(
        this.model,
        description,
        parameters,
        output,
        this.options
      )

      if (this.options.cache) {
        let cacheObject = {}
        try {
          const cache = await fs.readFile(this.options.cacheFile, 'utf-8')
          cacheObject = JSON.parse(cache)
        } catch (e) {
          // console.log('cache file not found')
        }

        cacheObject[description] = codeContent
        await fs.writeFile(this.options.cacheFile, JSON.stringify(cacheObject))
      }
    }

    if (this.options.debug === true) {
      console.log('code', codeContent.code)
      console.log('packages', codeContent.npmModules)
    }

    return async (params?: z.infer<T>): Promise<z.infer<O>> => {
      return this.backend.exec(codeContent, params)
    }
  }
}
