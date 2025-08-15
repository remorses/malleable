import type {
  LiveServerMessage,
  LiveClientMessage,
  LiveServerContent,
  LiveClientContent,
  LiveClientRealtimeInput,
  Content,
  Part,
  FunctionCall,
  FunctionResponse,
  LiveClientToolResponse,
  LiveServerToolCall,
} from '@google/genai'

import type {
  UIMessage,
  UIMessagePart,
  TextUIPart,
  ToolUIPart,
  FileUIPart,
  DataUIPart,
  UIDataTypes,
  UITools,
} from 'ai'

/**
 * Represents a part that can be added to a UI message
 */
export type UIPartUpdate = {
  part: UIMessagePart<UIDataTypes, UITools>
  role: 'system' | 'user' | 'assistant'
  isFinal?: boolean // Indicates if this part completes a turn
}

/**
 * Manages the assembly of websocket messages into UI messages
 */
export class LiveMessageAssembler {
  private currentUserParts: UIMessagePart<UIDataTypes, UITools>[] = []
  private currentAssistantParts: UIMessagePart<UIDataTypes, UITools>[] = []
  private messageIdCounter = 0

  /**
   * Process a server websocket message and extract UI parts
   */
  processServerMessage(message: LiveServerMessage): UIPartUpdate[] {
    const updates: UIPartUpdate[] = []

    // Handle server content (model responses)
    if (message.serverContent?.modelTurn) {
      const parts = this.extractPartsFromContent(
        message.serverContent.modelTurn,
      )
      for (const part of parts) {
        updates.push({
          part,
          role: 'assistant',
          isFinal: false,
        })
      }

      // Check if turn is complete
      if (message.serverContent.turnComplete) {
        updates.push({
          part: { type: 'text', text: '' } as TextUIPart, // Empty marker
          role: 'assistant',
          isFinal: true,
        })
      }
    }

    // Handle tool calls
    if (message.toolCall?.functionCalls) {
      for (const functionCall of message.toolCall.functionCalls) {
        updates.push({
          part: this.functionCallToToolPart(functionCall),
          role: 'assistant',
          isFinal: false,
        })
      }
    }

    return updates
  }

  /**
   * Process a client websocket message and extract UI parts
   */
  processClientMessage(message: LiveClientMessage): UIPartUpdate[] {
    const updates: UIPartUpdate[] = []

    // Handle client content
    if (message.clientContent?.turns) {
      for (const turn of message.clientContent.turns) {
        const role = this.determineRole(turn.role)
        const parts = this.extractPartsFromContent(turn)

        for (const part of parts) {
          updates.push({
            part,
            role,
            isFinal: false,
          })
        }
      }

      // Check if turn is complete
      if (message.clientContent.turnComplete) {
        const lastTurn =
          message.clientContent.turns[message.clientContent.turns.length - 1]
        const role = this.determineRole(lastTurn?.role)
        updates.push({
          part: { type: 'text', text: '' } as TextUIPart, // Empty marker
          role,
          isFinal: true,
        })
      }
    }

    // Handle realtime input (streaming)
    if (message.realtimeInput) {
      const parts = this.processRealtimeInput(message.realtimeInput)
      const isActivityEnd = !!message.realtimeInput.activityEnd
      for (const part of parts) {
        updates.push({
          part,
          role: 'user',
          isFinal: isActivityEnd,
        })
      }
    }

    // Handle tool responses
    if (message.toolResponse?.functionResponses) {
      for (const response of message.toolResponse.functionResponses) {
        updates.push({
          part: this.functionResponseToToolPart(response),
          role: 'user',
          isFinal: false,
        })
      }
    }

    return updates
  }

  /**
   * Add parts to the assembler and get completed messages
   */
  addParts(updates: UIPartUpdate[]): UIMessage[] {
    const completedMessages: UIMessage[] = []

    for (const update of updates) {
      // Skip empty marker parts
      if (
        update.part.type === 'text' &&
        (update.part as TextUIPart).text === '' &&
        update.isFinal
      ) {
        // This is just a turn completion marker
        if (update.role === 'user' && this.currentUserParts.length > 0) {
          completedMessages.push(
            this.createMessage('user', this.currentUserParts),
          )
          this.currentUserParts = []
        } else if (
          update.role === 'assistant' &&
          this.currentAssistantParts.length > 0
        ) {
          completedMessages.push(
            this.createMessage('assistant', this.currentAssistantParts),
          )
          this.currentAssistantParts = []
        }
      } else {
        // Add the actual part
        if (update.role === 'user') {
          this.currentUserParts.push(update.part)
        } else if (update.role === 'assistant') {
          this.currentAssistantParts.push(update.part)
        }

        // Check if turn is complete
        if (update.isFinal) {
          if (update.role === 'user' && this.currentUserParts.length > 0) {
            completedMessages.push(
              this.createMessage('user', this.currentUserParts),
            )
            this.currentUserParts = []
          } else if (
            update.role === 'assistant' &&
            this.currentAssistantParts.length > 0
          ) {
            completedMessages.push(
              this.createMessage('assistant', this.currentAssistantParts),
            )
            this.currentAssistantParts = []
          }
        }
      }
    }

    return completedMessages
  }

  /**
   * Get current incomplete message parts
   */
  getCurrentParts(
    role: 'user' | 'assistant',
  ): UIMessagePart<UIDataTypes, UITools>[] {
    return role === 'user'
      ? [...this.currentUserParts]
      : [...this.currentAssistantParts]
  }

  /**
   * Force flush any pending parts as messages
   */
  flush(): UIMessage[] {
    const messages: UIMessage[] = []

    if (this.currentUserParts.length > 0) {
      messages.push(this.createMessage('user', this.currentUserParts))
      this.currentUserParts = []
    }

    if (this.currentAssistantParts.length > 0) {
      messages.push(this.createMessage('assistant', this.currentAssistantParts))
      this.currentAssistantParts = []
    }

    return messages
  }

  /**
   * Extract UI parts from GenAI Content
   */
  private extractPartsFromContent(
    content: Content,
  ): UIMessagePart<UIDataTypes, UITools>[] {
    if (!content.parts) return []

    return content.parts
      .map((part) => this.convertPartToUIPart(part))
      .filter((p): p is UIMessagePart<UIDataTypes, UITools> => p !== null)
  }

  /**
   * Process realtime input into UI parts
   */
  private processRealtimeInput(
    input: LiveClientRealtimeInput,
  ): UIMessagePart<UIDataTypes, UITools>[] {
    const parts: UIMessagePart<UIDataTypes, UITools>[] = []

    // Handle text streaming
    if (input.text) {
      parts.push({
        type: 'text',
        text: input.text,
        state: input.activityEnd ? 'done' : 'streaming',
      } as TextUIPart)
    }

    // Handle audio chunks
    if (input.audio) {
      parts.push({
        type: 'data-url',
        data: {
          mimeType: 'audio/pcm',
          url: `data:audio/pcm;base64,${input.audio}`,
        },
      } as DataUIPart<UIDataTypes>)
    }

    // Handle video chunks
    if (input.video) {
      parts.push({
        type: 'data-url',
        data: {
          mimeType: 'video/mp4',
          url: `data:video/mp4;base64,${input.video}`,
        },
      } as DataUIPart<UIDataTypes>)
    }

    // Handle media chunks
    if (input.mediaChunks) {
      for (const chunk of input.mediaChunks) {
        if (chunk && typeof chunk === 'object' && 'mimeType' in chunk) {
          parts.push({
            type: 'data-url',
            data: {
              mimeType: chunk.mimeType || 'application/octet-stream',
              url: `data:${chunk.mimeType};base64,${chunk.data}`,
            },
          } as DataUIPart<UIDataTypes>)
        }
      }
    }

    return parts
  }

  /**
   * Convert GenAI Part to UI Part
   */
  private convertPartToUIPart(
    part: Part | string,
  ): UIMessagePart<UIDataTypes, UITools> | null {
    // Handle string parts
    if (typeof part === 'string') {
      return {
        type: 'text',
        text: part,
      } as TextUIPart
    }

    // Handle text parts
    if ('text' in part && part.text) {
      return {
        type: 'text',
        text: part.text,
        providerMetadata: part.thought
          ? { thought: { value: true } }
          : undefined,
      } as TextUIPart
    }

    // Handle inline data
    if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || 'application/octet-stream'
      return {
        type: 'data-url',
        data: {
          mimeType,
          url: `data:${mimeType};base64,${part.inlineData.data}`,
        },
      } as DataUIPart<UIDataTypes>
    }

    // Handle file data
    if (part.fileData) {
      return {
        type: 'file',
        name: part.fileData.fileUri || 'file',
        url: part.fileData.fileUri,
        mediaType: part.fileData.mimeType || 'application/octet-stream',
      } as FileUIPart
    }

    // Handle function calls
    if ('functionCall' in part && part.functionCall) {
      return this.functionCallToToolPart(part.functionCall)
    }

    // Handle function responses
    if ('functionResponse' in part && part.functionResponse) {
      return this.functionResponseToToolPart(part.functionResponse)
    }

    // Handle code execution results
    if (part.codeExecutionResult) {
      return {
        type: 'text',
        text: part.codeExecutionResult.output || '',
        providerMetadata: {
          codeExecution: { result: true },
          outcome: { value: part.codeExecutionResult.outcome },
        },
      } as TextUIPart
    }

    // Handle executable code
    if (part.executableCode) {
      return {
        type: 'text',
        text: `\`\`\`${part.executableCode.language || ''}\n${part.executableCode.code}\n\`\`\``,
        providerMetadata: { executableCode: { value: true } },
      } as TextUIPart
    }

    return null
  }

  /**
   * Convert FunctionCall to Tool UI Part
   */
  private functionCallToToolPart(
    functionCall: FunctionCall,
  ): ToolUIPart<UITools> {
    return {
      type: 'tool-call',
      toolCallId: functionCall.id || this.generateId(),
      state: 'input-available',
      input: functionCall.args || {},
      rawInput: functionCall.args || {},
    } as ToolUIPart<UITools>
  }

  /**
   * Convert FunctionResponse to Tool UI Part
   */
  private functionResponseToToolPart(
    response: FunctionResponse,
  ): ToolUIPart<UITools> {
    const responseData = response.response || {}
    const isError = 'error' in responseData

    if (isError) {
      return {
        type: 'tool-result',
        toolCallId: response.id || this.generateId(),
        state: 'output-error',
        input: {},
        errorText: JSON.stringify(responseData.error),
      } as ToolUIPart<UITools>
    }

    return {
      type: 'tool-result',
      toolCallId: response.id || this.generateId(),
      state: 'output-available',
      input: {},
      output: responseData.output || responseData,
    } as ToolUIPart<UITools>
  }

  /**
   * Create a UIMessage from parts
   */
  private createMessage(
    role: 'system' | 'user' | 'assistant',
    parts: UIMessagePart<UIDataTypes, UITools>[],
  ): UIMessage {
    return {
      id: this.generateId(),
      role,
      parts: [...parts], // Create a copy
    }
  }

  /**
   * Determine role from GenAI role string
   */
  private determineRole(role?: string): 'system' | 'user' | 'assistant' {
    if (!role) return 'user'
    if (role === 'model') return 'assistant'
    if (role === 'system' || role === 'user' || role === 'assistant')
      return role
    return 'user'
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${++this.messageIdCounter}`
  }
}

/**
 * Simple conversion functions for one-off conversions
 */

/**
 * Convert a single server message to UI parts
 */
export function serverMessageToParts(
  message: LiveServerMessage,
): UIPartUpdate[] {
  const assembler = new LiveMessageAssembler()
  return assembler.processServerMessage(message)
}

/**
 * Convert a single client message to UI parts
 */
export function clientMessageToParts(
  message: LiveClientMessage,
): UIPartUpdate[] {
  const assembler = new LiveMessageAssembler()
  return assembler.processClientMessage(message)
}

/**
 * Stream processor for converting websocket messages to UI messages
 */
export async function* processWebSocketStream(
  messages: AsyncIterable<LiveServerMessage | LiveClientMessage>,
  isServerMessage: boolean = true,
): AsyncGenerator<UIMessage> {
  const assembler = new LiveMessageAssembler()

  for await (const message of messages) {
    const updates = isServerMessage
      ? assembler.processServerMessage(message as LiveServerMessage)
      : assembler.processClientMessage(message as LiveClientMessage)

    const completedMessages = assembler.addParts(updates)
    for (const msg of completedMessages) {
      yield msg
    }
  }

  // Flush any remaining parts
  const finalMessages = assembler.flush()
  for (const msg of finalMessages) {
    yield msg
  }
}

/**
 * Convert UIMessage back to GenAI format (for sending)
 */
export function uiMessageToClientMessage(
  message: UIMessage,
  turnComplete: boolean = true,
): LiveClientMessage {
  // Check if this message contains tool responses
  const toolResponses = message.parts
    .filter((part) => part.type === 'tool-result')
    .map((part) => {
      const toolPart = part as ToolUIPart<UITools>
      return {
        id: toolPart.toolCallId,
        name: '', // Tool name not available in UI part
        response:
          toolPart.state === 'output-error'
            ? { error: toolPart.errorText }
            : toolPart.output || {},
      } as FunctionResponse
    })

  if (toolResponses.length > 0) {
    return {
      toolResponse: {
        functionResponses: toolResponses,
      },
    }
  }

  // Convert to regular content message
  const parts: Part[] = message.parts
    .map((part) => uiPartToGenAIPart(part))
    .filter((p): p is Part => p !== null)

  return {
    clientContent: {
      turns: [
        {
          role: message.role,
          parts,
        },
      ],
      turnComplete,
    },
  }
}

/**
 * Convert UI Part to GenAI Part
 */
function uiPartToGenAIPart(
  part: UIMessagePart<UIDataTypes, UITools>,
): Part | null {
  switch (part.type) {
    case 'text':
      return {
        text: (part as TextUIPart).text,
      } as Part

    case 'file':
      const filePart = part as FileUIPart
      return {
        fileData: {
          fileUri: filePart.url,
          mimeType: filePart.mediaType,
        },
      } as Part

    case 'tool-call':
      const toolCall = part as ToolUIPart<UITools>
      return {
        functionCall: {
          id: toolCall.toolCallId,
          name: '', // Tool name not preserved in UI part
          args: toolCall.input as Record<string, unknown>,
        },
      } as Part

    default:
      // Handle data parts
      if (part.type.startsWith('data-')) {
        const dataPart = part as DataUIPart<UIDataTypes>
        if (
          dataPart.data &&
          typeof dataPart.data === 'object' &&
          'url' in dataPart.data
        ) {
          // Extract base64 data from data URL
          const dataUrl = dataPart.data.url as string
          const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (base64Match) {
            // Extract mime type from the data URL itself
            const mimeType = base64Match[1] || 'application/octet-stream'
            return {
              inlineData: {
                mimeType: mimeType,
                data: base64Match[2],
              },
            } as Part
          }
        }
      }
      return null
  }
}
