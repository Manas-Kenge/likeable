import { Template, waitForPort } from 'e2b'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dockerfileContent = readFileSync(join(__dirname, '../e2b.Dockerfile'), 'utf-8')

export const template = Template({
  fileContextPath: '..',
})
  .fromDockerfile(dockerfileContent)
  .setWorkdir('/app')
  .setStartCmd('npm run dev', waitForPort(3000))