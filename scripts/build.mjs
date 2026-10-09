import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../public/', import.meta.url))
const output = fileURLToPath(new URL('../dist/', import.meta.url))
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await cp(source, output, { recursive: true })
console.log('Static preview built in dist/')
