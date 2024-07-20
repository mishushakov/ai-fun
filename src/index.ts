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
}

export default class AIFunctionExecutor {
  constructor(
    private model: LanguageModelV1,
    private options: AIFunctionExecutorOptions = {
      debug: false,
      packageFile: 'package.json',
      installPackages: true,
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
    const parametersSchema = zodToJsonSchema(parameters || z.null())
    const outputSchema = zodToJsonSchema(output || z.null())

    const systemSchema = z.object({
      code: z.string(),
      npmModules: z.array(z.string()),
    })

    const { object } = await generateObject({
      model: this.model,
      system: `Provide a Node.js function that according to the given function signature. No comments, external packages are supported. Use function syntax. Your can only respond with code.`,
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

    if (this.options.debug === true) {
      console.log('code', object.code)
      console.log('external modules', object.npmModules)
    }

    if (object.npmModules.length > 0 && this.options.installPackages) {
      let packageJsonObject = {
        dependencies: {},
      }

      const packageJsonDir = path.dirname(this.options.packageFile || '.')

      if (this.options.packageFile) {
        const packageJson = await fs.readFile(this.options.packageFile, 'utf-8')
        packageJsonObject = JSON.parse(packageJson)
      }

      for (const packageName of object.npmModules) {
        if (!packageJsonObject.dependencies[packageName]) {
          if (this.options.debug) console.log('installing package', packageName)
          exec(
            `npm install ${packageName}`,
            { cwd: packageJsonDir },
            (err, stdout) => {
              if (err) throw err
              if (this.options.debug) console.log(stdout)
            }
          )
        }
      }
    }

    const script = new vm.Script(object.code)
    script.runInThisContext()

    return async (params?: z.infer<T>): Promise<z.infer<O>> => {
      return vm.runInThisContext(`f(${superjson.stringify(params)})`)
    }
  }
}
