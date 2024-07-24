import vm from 'node:vm'
import superjson from 'superjson'
import { exec } from 'node:child_process'
import path from 'node:path'
import fs from 'fs/promises'
import { AIFunctionBackend, CodeContent } from '../index.js'

type NodeExecOptions = {
  debug?: boolean
  packageFile?: string
  installPackages?: boolean
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

global.require = require

export default class NodeExec implements AIFunctionBackend {
  // private ctx: vm.Context
  constructor(
    private options: NodeExecOptions = {
      packageFile: 'package.json',
      installPackages: true,
    }
  ) {
    this.options = options
  }

  async init(codeContent: CodeContent) {
    if (codeContent.npmModules.length > 0 && this.options.installPackages) {
      await installPackages(
        codeContent.npmModules,
        this.options.packageFile,
        this.options.debug
      )
    }

    // this.ctx = vm.createContext({
    //   require: require,
    //   console: console,
    // })

    vm.runInThisContext(codeContent.code.trim())
  }

  async exec(params: any) {
    const serialized = superjson.serialize(params)
    if (this.options.debug)
      console.log('Running with parameters:', JSON.stringify(serialized.json))
    return vm.runInThisContext(`f(${JSON.stringify(serialized.json)})`)
  }
}
