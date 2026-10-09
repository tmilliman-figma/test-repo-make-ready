import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const root = resolve(projectRoot, process.argv[2] ?? 'public')
const host = process.env.HOST ?? '0.0.0.0'
const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535')
}
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    if (pathname === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ status: 'ok', fixture: 'make-ready' }))
      return
    }
    const filename = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
    if (!filename.startsWith(`${root}${sep}`)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }
    const contents = await readFile(filename)
    response.writeHead(200, {
      'Content-Type': contentTypes[extname(filename)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(contents)
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 400)
    response.end('Not found')
  }
})
server.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
server.listen(port, host, () => {
  console.log(`Make-ready fixture listening on http://${host}:${server.address().port}`)
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close())
}
