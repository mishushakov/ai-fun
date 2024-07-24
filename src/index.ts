import { LanguageModelV1 } from '@ai-sdk/provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import fs from 'fs/promises'

type AIFunctionBuilderOptions = {
  debug?: boolean
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
  parameters: z.ZodTypeAny,
  output: z.ZodTypeAny,
  options: AIFunctionBuilderOptions
) {
  const parametersSchema = zodToJsonSchema(parameters || z.null())
  const outputSchema = zodToJsonSchema(output || z.null())

  const systemSchema = z.object({
    code: z.string(),
    npmModules: z.array(z.string().describe('only for list non built-in modules')),
  })

  const { object } = await generateObject({
    model: model,
    system: `Generate a Node.js function according to the given function signature.
    No comments, external packages are supported, use function syntax, no exports, syntax: "${
      options.esModules ? 'import' : 'commonjs'
    }". Your can only respond with code.`,
    prompt: `
    // ${description}
    f(params: ${JSON.stringify(parametersSchema)}): ${JSON.stringify(
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

export abstract class AIFunctionBackend {
  abstract init(codeContent: CodeContent): Promise<void>
  abstract exec(params: any): Promise<any>
}

export default class AIFunctionBuilder {
  constructor(
    private model: LanguageModelV1,
    private backend: AIFunctionBackend,
    private options: AIFunctionBuilderOptions = {
      debug: false,
      esModules: false,
      cache: true,
      cacheFile: '.ai-fun.json',
    }
  ) {
    this.model = model
    this.options = options
    this.backend = backend
  }

  async function<T extends z.ZodTypeAny, O extends z.ZodTypeAny>(
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

    await this.backend.init(codeContent)

    return async (params?: z.infer<T>): Promise<z.infer<O>> => {
      return this.backend.exec(params)
    }
  }
}
