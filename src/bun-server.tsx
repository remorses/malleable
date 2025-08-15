/// <reference types="bun" />
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import {
  prerenderComponent,
  prerenderRequestSchema,
  prerenderResultSchema,
  type PrerenderResponse,
} from './prerender.js'

// Create a Spiceflow API for the container
const app = new Spiceflow().route({
  method: 'POST',
  path: '/prerender',
  request: prerenderRequestSchema,
  response: prerenderResultSchema,
  async handler({ request }) {
    const input = await request.json()
    const result = await prerenderComponent(input, request.signal)
    return result as PrerenderResponse
  },
})

// Export the app type for client generation
export type ContainerApp = typeof app

// Start the server
const server = Bun.serve({
  port: 8080,
  hostname: '0.0.0.0',

  fetch: async (req, server) => {
    console.log(`Incoming request: ${req.method} ${req.url}`)
    return app.handle(req)
  },
})

console.log(`🚀 Spiceflow container server running on port ${server.port}`)
