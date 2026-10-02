import { Spiceflow } from 'spiceflow'
import { projectsApi, projectsPublic, type ProjectsEnv } from './projects-api.js'

export { ProjectDO } from './project-do.js'

// Plain JSON responses: REST clients do not decode superjson metadata
const app = new Spiceflow({ disableSuperJsonUnlessRpc: true })
  .state('env', {} as ProjectsEnv)
  .use(projectsApi)
  .use(projectsPublic)

export default {
  fetch(request: Request, env: ProjectsEnv) {
    return app.handle(request, { state: { env } })
  },
}
