import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = fileURLToPath(new URL('../', import.meta.url))
const run = promisify(execFile)
const script = (name) => join(root, '.figma', 'make', name)

async function startServer(t, built = false) {
  const processHandle = built
    ? spawn(process.execPath, ['scripts/server.mjs', 'dist'], {
        cwd: root,
        env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
      })
    : spawn(script('dev'), [], {
        cwd: tmpdir(),
        env: { ...process.env, FIGMA_DEV_SERVER_HOST: '127.0.0.1', PORT: '0' },
      })
  t.after(async () => {
    if (processHandle.exitCode === null && processHandle.signalCode === null) {
      const exited = once(processHandle, 'exit')
      processHandle.kill('SIGTERM')
      await exited
    }
  })
  return new Promise((resolve, reject) => {
    let output = ''
    let errors = ''
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${errors}`)), 10000)
    processHandle.stderr.on('data', (chunk) => { errors += chunk })
    processHandle.on('error', (error) => { clearTimeout(timeout); reject(error) })
    processHandle.on('exit', (code) => {
      clearTimeout(timeout)
      reject(new Error(`Server exited with ${code}: ${errors}`))
    })
    processHandle.stdout.on('data', (chunk) => {
      output += chunk
      const match = output.match(/listening on (http:\/\/127\.0\.0\.1:\d+)/)
      if (match) { clearTimeout(timeout); resolve(match[1]) }
    })
  })
}

test('Make lifecycle scripts are executable and declare the correct port', async () => {
  for (const name of ['setup', 'install', 'dev', 'deploy', 'deploy-preview']) {
    assert.ok((await stat(script(name))).mode & 0o111, `${name} must be executable`)
    assert.match(await readFile(script(name), 'utf8'), /^#!\/bin\/sh\nset -eu\n/)
  }
  const config = JSON.parse(await readFile(script('dev.json'), 'utf8'))
  assert.equal(config.port, 3000)
  assert.equal(config.scheme, 'http')
})

test('setup and install succeed without configuration, from any working directory', async () => {
  const { stdout } = await run(script('setup'), [], { cwd: tmpdir() })
  assert.match(stdout, /no environment variables required/)
  await run(script('install'), [], { cwd: tmpdir() })
})

test('the dev script serves the page, assets, and a health endpoint', async (t) => {
  const url = await startServer(t)
  const page = await fetch(url)
  assert.equal(page.status, 200)
  assert.match(await page.text(), /Ready from the first import/)
  const javascript = await fetch(`${url}/app.js`)
  assert.equal(javascript.status, 200)
  assert.match(await javascript.text(), /addEventListener\('click'/)
  const stylesheet = await fetch(`${url}/styles.css`)
  assert.equal(stylesheet.status, 200)
  assert.match(stylesheet.headers.get('content-type'), /text\/css/)
  const health = await fetch(`${url}/health`)
  assert.deepEqual(await health.json(), { status: 'ok', fixture: 'make-ready' })
  assert.equal((await fetch(`${url}/missing.txt`)).status, 404)
})

test('the build emits a standalone static preview with relative assets', async (t) => {
  await run(process.execPath, ['scripts/build.mjs'], { cwd: root })
  for (const filename of ['index.html', 'app.js', 'styles.css']) {
    assert.equal(
      await readFile(join(root, 'dist', filename), 'utf8'),
      await readFile(join(root, 'public', filename), 'utf8'),
    )
  }
  const url = await startServer(t, true)
  assert.match(await (await fetch(url)).text(), /href="\.\/styles.css"/)
})

for (const name of ['deploy-preview', 'deploy']) {
  test(`${name} builds the app and calls the Make CLI with the output directory`, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'make-ready-cli-'))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const log = join(directory, 'arguments.json')
    await writeFile(join(directory, 'figma'), [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      'fs.writeFileSync(process.env.FIXTURE_CLI_LOG, JSON.stringify(process.argv.slice(2)));',
      '',
    ].join('\n'), { mode: 0o755 })
    await run(script(name), [], {
      cwd: tmpdir(),
      env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, FIXTURE_CLI_LOG: log },
    })
    assert.deepEqual(JSON.parse(await readFile(log, 'utf8')), [
      'make', name, '--build-dir', 'dist',
    ])
    assert.match(await readFile(join(root, 'dist', 'index.html'), 'utf8'), /Ready from the first import/)
  })
}
