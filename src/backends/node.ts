import vm from 'node:vm'
import superjson from 'superjson'
import { exec } from 'node:child_process'
import path from 'node:path'
import fs from 'fs/promises'
import { ExecutorBackend, CodeContent } from '../index.js'

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

export default class NodeExec extends ExecutorBackend {
  constructor(
    private options: NodeExecOptions = {
      packageFile: 'package.json',
      installPackages: true,
    }
  ) {
    super()
    this.options = options
  }

  async exec(codeContent: CodeContent, params: any) {
    if (codeContent.npmModules.length > 0 && this.options.installPackages) {
      await installPackages(
        codeContent.npmModules,
        this.options.packageFile,
        this.options.debug
      )
    }

    const script = new vm.Script(codeContent.code)
    script.runInThisContext()
    return vm.runInThisContext(`f(${superjson.stringify(params)})`)
  }
}
