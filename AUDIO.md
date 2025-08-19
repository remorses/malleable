## Usage

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

```ts
import { z } from 'zod'
const handler = createAudioChatAPI({
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
