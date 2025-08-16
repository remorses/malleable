import { describe, it, expect } from 'vitest'
import type {
  LiveClientMessage,
  LiveServerContent,
  LiveClientContent,
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
} from '@google/genai'
import { Type, Modality, LiveServerMessage } from '@google/genai'
import { LiveMessageAssembler } from './genai-to-ui-message.js'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import exampleMessages from './mixtures/example.json' with { type: 'json' }

const __dirname = dirname(fileURLToPath(import.meta.url))

// Process example.json messages
describe('Example JSON Processing', () => {
  it('should process all messages from example.json and save snapshot', () => {
    const assembler = new LiveMessageAssembler()
    let allMessages: any[] = []

    // Process each message
    for (const message of exampleMessages) {
      const uiMessages = assembler.processMessage(message as LiveServerMessage)
      allMessages = uiMessages // Always get the complete state
    }

    // Create snapshots directory if it doesn't exist
    const snapshotsDir = join(__dirname, 'snapshots')
    mkdirSync(snapshotsDir, { recursive: true })

    // Save the snapshot
    const snapshotPath = join(snapshotsDir, 'example-ui-messages.json')
    writeFileSync(snapshotPath, JSON.stringify(allMessages, null, 2))

    // Verify we have messages
    expect(allMessages.length).toBeGreaterThan(0)

    // Basic structure check
    if (allMessages.length > 0) {
      expect(allMessages[0]).toHaveProperty('id')
      expect(allMessages[0]).toHaveProperty('role')
      expect(allMessages[0]).toHaveProperty('parts')
    }
  })
})

// Process partial streams
describe('Partial Stream Processing', () => {
  // Edge cases to test:
  // 3 - Just after first user input
  // 7 - Middle of assistant audio response  
  // 789 - After turnComplete (message boundary)
  // 812 - Just before user starts new input
  // 889 - After user completes "generate a component"
  // 1783 - After executableCode (tool call)
  // 1796 - After toolCall function call
  // 1809 - After codeExecutionResult (tool result)
  // 1862 - After second codeExecutionResult
  // 1914 - Just before interruption
  // 1915 - At interruption point
  // 1920 - After turnComplete following interruption
  // 1947 - After final usageMetadata
  const endIndexes = [
    3,     // After first user input transcription
    7,     // During assistant audio stream
    789,   // After first turnComplete
    812,   // Before next user input
    889,   // After user says "generate a component"
    1783,  // After executableCode part
    1796,  // After toolCall functionCalls
    1809,  // After first codeExecutionResult
    1862,  // After second codeExecutionResult  
    1914,  // Just before interrupted
    1915,  // At interrupted=true
    1920,  // After turnComplete post-interrupt
    1947,  // After usage metadata
  ]

  endIndexes.forEach(endIndex => {
    it(`should process messages up to index ${endIndex} and save snapshot`, () => {
      const assembler = new LiveMessageAssembler()
      let allMessages: any[] = []

      // Process messages up to endIndex
      const messagesToProcess = exampleMessages.slice(0, endIndex + 1)

      for (const message of messagesToProcess) {
        const uiMessages = assembler.processMessage(message as LiveServerMessage)
        allMessages = uiMessages
      }

      // Create snapshots directory if it doesn't exist
      const snapshotsDir = join(__dirname, 'snapshots')
      mkdirSync(snapshotsDir, { recursive: true })

      // Save the snapshot with padded index for proper sorting
      const paddedIndex = String(endIndex).padStart(4, '0')
      const snapshotPath = join(snapshotsDir, `partial-${paddedIndex}-ui-messages.json`)
      writeFileSync(snapshotPath, JSON.stringify(allMessages, null, 2))

      // Log info about this snapshot
      console.log(`Snapshot for index ${endIndex}: ${allMessages.length} UI messages`)
    })
  })
})

// Example conversation flow with tool calls
export const EXAMPLE_WEBSOCKET_CONVERSATION: {
  client: LiveClientMessage[]
  server: LiveServerMessage[]
} = {
  client: [
    // 1. Initial setup message
    {
      setup: {
        model: 'models/gemini-2.0-flash-exp',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          responseModalities: [Modality.TEXT],
        },
        systemInstruction: {
          parts: [
            { text: 'You are a helpful assistant with access to tools.' },
          ],
          role: 'system',
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'get_weather',
                description: 'Get the current weather for a location',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    location: { type: Type.STRING, description: 'City name' },
                    unit: {
                      type: Type.STRING,
                      enum: ['celsius', 'fahrenheit'],
                    },
                  },
                  required: ['location'],
                },
              },
            ],
          },
        ],
      },
    },

    // 2. User asks a question
    {
      clientContent: {
        turns: [
          {
            parts: [{ text: "What's the weather like in San Francisco?" }],
            role: 'user',
          },
        ],
        turnComplete: true,
      },
    },

    // 3. Client provides tool response
    {
      toolResponse: {
        functionResponses: [
          {
            id: 'call_123',
            name: 'get_weather',
            response: {
              output: {
                temperature: 72,
                condition: 'Partly cloudy',
                humidity: 65,
                unit: 'fahrenheit',
              },
            },
          },
        ],
      },
    },

    // 4. User sends follow-up with realtime input
    {
      realtimeInput: {
        text: 'Is that warm for this time',
        activityStart: {},
      },
    },

    // 5. Complete the realtime input
    {
      realtimeInput: {
        text: ' of year?',
        activityEnd: {},
      },
    },
  ],

  server: [
    // 1. Setup complete response
    {
      setupComplete: {
        sessionId: 'session_abc123',
      },
    } as LiveServerMessage,

    // 2. Model starts responding to weather question
    {
      serverContent: {
        modelTurn: {
          parts: [{ text: "I'll check the weather in San Francisco for you." }],
          role: 'model',
        },
        turnComplete: false,
      },
    } as LiveServerMessage,

    // 3. Model makes a tool call
    Object.assign(Object.create(LiveServerMessage.prototype), {
      toolCall: {
        functionCalls: [
          {
            id: 'call_123',
            name: 'get_weather',
            args: {
              location: 'San Francisco',
              unit: 'fahrenheit',
            },
          },
        ],
      },
    }) as LiveServerMessage,

    // 4. Model provides final response with weather info
    {
      serverContent: {
        modelTurn: {
          parts: [
            {
              text: 'Based on the current weather data, San Francisco is experiencing partly cloudy conditions with a temperature of 72°F and 65% humidity.',
            },
          ],
          role: 'model',
        },
        turnComplete: true,
        generationComplete: true,
      },
    } as LiveServerMessage,

    // 5. Model responds to follow-up question
    {
      serverContent: {
        modelTurn: {
          parts: [
            {
              text: 'Yes, 72°F is quite warm for San Francisco at this time of year. The city typically experiences temperatures in the 60s, so this is above average. The moderate humidity at 65% makes it feel comfortable despite being warmer than usual.',
            },
          ],
          role: 'model',
        },
        turnComplete: true,
      },
    } as LiveServerMessage,

    // 6. Usage metadata
    Object.assign(Object.create(LiveServerMessage.prototype), {
      usageMetadata: {
        promptTokenCount: 156,
        candidatesTokenCount: 89,
        totalTokenCount: 245,
      },
    }) as LiveServerMessage,
  ],
}

// Additional example: Multi-part content with code and images
export const EXAMPLE_MULTIPART_MESSAGE: LiveServerMessage = {
  serverContent: {
    modelTurn: {
      parts: [
        { text: "Here's how to implement a weather API client:" },
        {
          executableCode: {
            code: `async function getWeather(city) {
  const response = await fetch(\`/api/weather?city=\${city}\`);
  return response.json();
}`,
            language: 'javascript',
          },
        },
        { text: "And here's the expected response format:" },
        {
          codeExecutionResult: {
            output: '{ "temperature": 72, "condition": "Partly cloudy" }',
            outcome: 'OUTCOME_OK',
          },
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          },
        },
      ],
      role: 'model',
    },
    turnComplete: true,
  },
} as LiveServerMessage

describe('LiveMessageAssembler', () => {
  it('should convert server setup complete message', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.server[0]
    const parts = assembler.processServerMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      []
    `)
  })

  it('should convert server content message to text parts', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.server[1]
    const parts = assembler.processServerMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "providerMetadata": undefined,
            "text": "I'll check the weather in San Francisco for you.",
            "type": "text",
          },
          "role": "assistant",
        },
      ]
    `)
  })

  it('should convert tool call message to tool parts', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.server[2]
    const parts = assembler.processServerMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "input": {
              "location": "San Francisco",
              "unit": "fahrenheit",
            },
            "state": "input-available",
            "toolCallId": "call_123",
            "toolName": "get_weather",
            "type": "tool-call",
          },
          "role": "assistant",
        },
      ]
    `)
  })

  it('should handle turn complete flag', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.server[3]
    const parts = assembler.processServerMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "providerMetadata": undefined,
            "text": "Based on the current weather data, San Francisco is experiencing partly cloudy conditions with a temperature of 72°F and 65% humidity.",
            "type": "text",
          },
          "role": "assistant",
        },
        {
          "isFinal": true,
          "part": {
            "text": "",
            "type": "text",
          },
          "role": "assistant",
        },
      ]
    `)
  })

  it('should convert client content message', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.client[1]
    const parts = assembler.processClientMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "providerMetadata": undefined,
            "text": "What's the weather like in San Francisco?",
            "type": "text",
          },
          "role": "user",
        },
        {
          "isFinal": true,
          "part": {
            "text": "",
            "type": "text",
          },
          "role": "user",
        },
      ]
    `)
  })

  it('should convert tool response message', () => {
    const assembler = new LiveMessageAssembler()
    const message = EXAMPLE_WEBSOCKET_CONVERSATION.client[2]
    const parts = assembler.processClientMessage(message)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "input": {},
            "output": {
              "condition": "Partly cloudy",
              "humidity": 65,
              "temperature": 72,
              "unit": "fahrenheit",
            },
            "state": "output-available",
            "toolCallId": "call_123",
            "toolName": "get_weather",
            "type": "tool-result",
          },
          "role": "user",
        },
      ]
    `)
  })

  it('should handle realtime input streaming', () => {
    const assembler = new LiveMessageAssembler()
    const startMessage = EXAMPLE_WEBSOCKET_CONVERSATION.client[3]
    const endMessage = EXAMPLE_WEBSOCKET_CONVERSATION.client[4]

    const startParts = assembler.processClientMessage(startMessage)
    expect(startParts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "state": "streaming",
            "text": "Is that warm for this time",
            "type": "text",
          },
          "role": "user",
        },
      ]
    `)

    const endParts = assembler.processClientMessage(endMessage)
    expect(endParts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": true,
          "part": {
            "state": "done",
            "text": " of year?",
            "type": "text",
          },
          "role": "user",
        },
      ]
    `)
  })

  it('should handle multipart content with code and images', () => {
    const assembler = new LiveMessageAssembler()
    const parts = assembler.processServerMessage(EXAMPLE_MULTIPART_MESSAGE)

    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "isFinal": false,
          "part": {
            "providerMetadata": undefined,
            "text": "Here's how to implement a weather API client:",
            "type": "text",
          },
          "role": "assistant",
        },
        {
          "isFinal": false,
          "part": {
            "input": {
              "code": "async function getWeather(city) {
        const response = await fetch(\`/api/weather?city=\${city}\`);
        return response.json();
      }",
              "language": "javascript",
            },
            "state": "input-available",
            "toolCallId": "exec-1755351834679-hl2a3",
            "toolName": "executableCode",
            "type": "tool-call",
          },
          "role": "assistant",
        },
        {
          "isFinal": false,
          "part": {
            "providerMetadata": undefined,
            "text": "And here's the expected response format:",
            "type": "text",
          },
          "role": "assistant",
        },
        {
          "isFinal": false,
          "part": {
            "input": {},
            "output": "{ "temperature": 72, "condition": "Partly cloudy" }",
            "state": "output-available",
            "toolCallId": "exec-1755351834679-rajgj",
            "toolName": "executableCode",
            "type": "tool-result",
          },
          "role": "assistant",
        },
        {
          "isFinal": false,
          "part": {
            "data": {
              "mimeType": "image/png",
              "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
            },
            "type": "data-url",
          },
          "role": "assistant",
        },
        {
          "isFinal": true,
          "part": {
            "text": "",
            "type": "text",
          },
          "role": "assistant",
        },
      ]
    `)
  })

  it('should assemble parts into complete messages', () => {
    const assembler = new LiveMessageAssembler()

    // Process user message
    const userParts = assembler.processClientMessage(
      EXAMPLE_WEBSOCKET_CONVERSATION.client[1],
    )
    const userMessages = assembler.addParts(userParts)

    expect(userMessages).toMatchInlineSnapshot(`
      [
        {
          "id": "msg_1755351834679_1",
          "parts": [
            {
              "providerMetadata": undefined,
              "text": "What's the weather like in San Francisco?",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `)

    // Process assistant response
    const assistantParts1 = assembler.processServerMessage(
      EXAMPLE_WEBSOCKET_CONVERSATION.server[1],
    )
    const messages1 = assembler.addParts(assistantParts1)
    expect(messages1).toMatchInlineSnapshot(`
      []
    `)

    // Process tool call
    const toolCallParts = assembler.processServerMessage(
      EXAMPLE_WEBSOCKET_CONVERSATION.server[2],
    )
    const messages2 = assembler.addParts(toolCallParts)
    expect(messages2).toMatchInlineSnapshot(`
      []
    `)

    // Process final response with turn complete
    const finalParts = assembler.processServerMessage(
      EXAMPLE_WEBSOCKET_CONVERSATION.server[3],
    )
    const finalMessages = assembler.addParts(finalParts)

    expect(finalMessages).toMatchInlineSnapshot(`
      [
        {
          "id": "msg_1755351834680_2",
          "parts": [
            {
              "providerMetadata": undefined,
              "text": "I'll check the weather in San Francisco for you.",
              "type": "text",
            },
            {
              "input": {
                "location": "San Francisco",
                "unit": "fahrenheit",
              },
              "state": "input-available",
              "toolCallId": "call_123",
              "toolName": "get_weather",
              "type": "tool-call",
            },
            {
              "providerMetadata": undefined,
              "text": "Based on the current weather data, San Francisco is experiencing partly cloudy conditions with a temperature of 72°F and 65% humidity.",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `)
  })

  it('should handle flush to get incomplete messages', () => {
    const assembler = new LiveMessageAssembler()

    // Add some parts without turn complete
    const parts = assembler.processServerMessage(
      EXAMPLE_WEBSOCKET_CONVERSATION.server[1],
    )
    assembler.addParts(parts)

    // Flush should return the incomplete message
    const flushedMessages = assembler.flush()

    expect(flushedMessages).toMatchInlineSnapshot(`
      [
        {
          "id": "msg_1755351834680_1",
          "parts": [
            {
              "providerMetadata": undefined,
              "text": "I'll check the weather in San Francisco for you.",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `)
  })
})
