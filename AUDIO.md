## Usage

the hook is used to instantiate the liveapi client and disconnect on unmount. the instance should be created inside useState to make it constant.

the url is what fetch will use to call the tools to get the tool results, passing the headers too. after calling fetch on the url with post the client should add the tool response.

Ontoolcall can be also used to listen for tool calls and add results client side instead of server side.

```tsx
function App() {
  const { connect, disconnect, addToolResult } = useAudioChat({
    url: '/api/audiochat',
    headers: {
      authorization: `bearer ${token}`,
    },
    // pass a tool call with ai type ToolCall
    async onToolCall({ toolCall }) {
      if (toolCall.toolName === 'getWeather') {
        // addToolResult can be used to run tool client side instead of server side.
        addToolResult({
          tool: 'getWeather',
          toolCallId: toolCall.toolCallId,
          output: 'Rome',
        })
      }
    },
  })

  return (
    <div className='flex gap-4'>
      <button
        className='bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition'
        onClick={connect}
      >
        Connect
      </button>
      <button
        className='bg-gray-500 text-white py-2 px-4 rounded hover:bg-gray-600 transition'
        onClick={disconnect}
      >
        Disconnect
      </button>
    </div>
  )
}
```

## API handler

The client hook will send tool calls to this API to get the tool results.

the api handler is just a way to run the tool calls and get their results via POST and nothing else.

The GET request instead will send the tools available, via a name, description, inputSchema array of objects.

The client will then recreate the tools objects to pass to the liveapi client. the execute will be a simple fetch request to this endpoint with POST and a body of the tool name and input parameters. This api will respones with the tool result by running the execute.

This server code does not need the liveapi client.


```ts
import { z } from 'zod'
const handler = createAudioChatAPI({
  geminiApiKey: process.env.X,
  tools: {
    // ai sdk tools
    getWeather: tool({
      inputSchema: z.object({ location: z.string() }),
      execute({ location }) {
        return 'Good'
      },
    }),
  },
  async onRequest({ request }) {
    const session = await getSession(request)
    if (!session) {
      throw new Error(`unauthorized`)
    }
  },
})

export const POST = handler
export const GET = handler
```
