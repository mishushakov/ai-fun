import { LanguageModelV1 } from '@ai-sdk/provider'
import { generateObject, generateText } from 'ai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import vm from 'node:vm'
import superjson from 'superjson'
import fs from 'fs/promises'
import { exec } from 'node:child_process'
import path from 'node:path'

type AIFunctionExecutorOptions = {
  packageFile?: string
  debug?: boolean
  installPackages?: boolean
  esModules?: boolean
  backend?: 'exec'
  cache?: boolean
  cacheFile?: string
}

type CodeContent = {
  code: string
  npmModules: string[]
}

type CacheContent = {
  [key: string]: CodeContent
}

async function installPackages(
  npmModules: string[],
  packageFile: string,
  debug: boolean
) {
  let packageJsonObject = {
    dependencies: {},
  }

  const packageJsonDir = path.dirname(packageFile || '.')

  if (packageFile) {
    const packageJson = await fs.readFile(packageFile, 'utf-8')
    packageJsonObject = JSON.parse(packageJson)
  }

  for (const packageName of npmModules) {
    if (!packageJsonObject.dependencies[packageName]) {
      if (debug) console.log('installing package', packageName)
      exec(
        `npm install ${packageName}`,
        { cwd: packageJsonDir },
        (err, stdout) => {
          if (err) throw err
          if (debug) console.log(stdout)
        }
      )
    }
  }
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

export default class AIFunctionExecutor {
  constructor(
    private model: LanguageModelV1,
    private options: AIFunctionExecutorOptions = {
      debug: false,
      packageFile: 'package.json',
      installPackages: true,
      esModules: false,
      backend: 'exec',
      cache: true,
      cacheFile: '.cache/ai-function-executor.json',
    }
  ) {
    this.model = model
    this.options = options
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

    if (codeContent.npmModules.length > 0 && this.options.installPackages) {
      await installPackages(
        codeContent.npmModules,
        this.options.packageFile,
        this.options.debug
      )
    }

    const script = new vm.Script(codeContent.code)
    script.runInThisContext()

    return async (params?: z.infer<T>): Promise<z.infer<O>> => {
      return vm.runInThisContext(`f(${superjson.stringify(params)})`)
    }
  }
}
