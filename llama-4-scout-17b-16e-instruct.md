---
title: llama-4-scout-17b-16e-instruct · Cloudflare Workers AI docs
description: Meta's Llama 4 Scout is a 17 billion parameter model with 16
  experts that is natively multimodal. These models leverage a
  mixture-of-experts architecture to offer industry-leading performance in text
  and image understanding.
chatbotDeprioritize: false
source_url:
  html: https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/
  md: https://developers.cloudflare.com/workers-ai/models/llama-4-scout-17b-16e-instruct/index.md
---

![Meta logo](https://developers.cloudflare.com/_astro/meta.x5nlFKBG.svg)

# llama-4-scout-17b-16e-instruct

Text Generation • Meta

@cf/meta/llama-4-scout-17b-16e-instruct

Meta's Llama 4 Scout is a 17 billion parameter model with 16 experts that is natively multimodal. These models leverage a mixture-of-experts architecture to offer industry-leading performance in text and image understanding.

| Model Info | |
| - | - |
| Context Window[](https://developers.cloudflare.com/workers-ai/glossary/) | 131,000 tokens |
| Terms and License | [link](https://github.com/meta-llama/llama-models/blob/main/models/llama4/LICENSE) |
| Function calling[](https://developers.cloudflare.com/workers-ai/function-calling) | Yes |
| Batch | Yes |
| Unit Pricing | $0.27 per M input tokens, $0.85 per M output tokens |

## Playground

Try out this model with Workers AI LLM Playground. It does not require any setup or authentication and an instant way to preview and test a model directly in the browser.

[Launch the LLM Playground](https://playground.ai.cloudflare.com/?model=@cf/meta/llama-4-scout-17b-16e-instruct)

## Usage

Worker - Streaming

```ts
export interface Env {
  AI: Ai;
}


export default {
  async fetch(request, env): Promise<Response> {


    const messages = [
      { role: "system", content: "You are a friendly assistant" },
      {
        role: "user",
        content: "What is the origin of the phrase Hello, World",
      },
    ];


    const stream = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", {
      messages,
      stream: true,
    });


    return new Response(stream, {
      headers: { "content-type": "text/event-stream" },
    });
  },
} satisfies ExportedHandler<Env>;
```

Worker

```ts
export interface Env {
  AI: Ai;
}


export default {
  async fetch(request, env): Promise<Response> {


    const messages = [
      { role: "system", content: "You are a friendly assistant" },
      {
        role: "user",
        content: "What is the origin of the phrase Hello, World",
      },
    ];
    const response = await env.AI.run("@cf/meta/llama-4-scout-17b-16e-instruct", { messages });


    return Response.json(response);
  },
} satisfies ExportedHandler<Env>;
```

Python

```py
import os
import requests


ACCOUNT_ID = "your-account-id"
AUTH_TOKEN = os.environ.get("CLOUDFLARE_AUTH_TOKEN")


prompt = "Tell me all about PEP-8"
response = requests.post(
  f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct",
    headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
    json={
      "messages": [
        {"role": "system", "content": "You are a friendly assistant"},
        {"role": "user", "content": prompt}
      ]
    }
)
result = response.json()
print(result)
```

curl

```sh
curl https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/ai/run/@cf/meta/llama-4-scout-17b-16e-instruct \
  -X POST \
  -H "Authorization: Bearer $CLOUDFLARE_AUTH_TOKEN" \
  -d '{ "messages": [{ "role": "system", "content": "You are a friendly assistant" }, { "role": "user", "content": "Why is pizza so good" }]}'
```

OpenAI compatible endpoints

Workers AI also supports OpenAI compatible API endpoints for `/v1/chat/completions` and `/v1/embeddings`. For more details, refer to [Configurations ](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/).

## Parameters

\* indicates a required field

### Input

* `0` object

  * `prompt` string required min 1

    The input text prompt for the model to generate a response.

  * `guided_json` object

    JSON schema that should be fulfilled for the response.

  * `response_format` object

    * `type` string

    * `json_schema`

  * `raw` boolean

    If true, a chat template is not applied and you must adhere to the specific model's expected formatting.

  * `stream` boolean

    If true, the response will be streamed back incrementally using SSE, Server Sent Events.

  * `max_tokens` integer default 256

    The maximum number of tokens to generate in the response.

  * `temperature` number default 0.15 min 0 max 5

    Controls the randomness of the output; higher values produce more random results.

  * `top_p` number min 0 max 2

    Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.

  * `top_k` integer min 1 max 50

    Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.

  * `seed` integer min 1 max 9999999999

    Random seed for reproducibility of the generation.

  * `repetition_penalty` number min 0 max 2

    Penalty for repeated tokens; higher values discourage repetition.

  * `frequency_penalty` number min 0 max 2

    Decreases the likelihood of the model repeating the same lines verbatim.

  * `presence_penalty` number min 0 max 2

    Increases the likelihood of the model introducing new topics.

* `1` object

  * `messages` array required

    An array of message objects representing the conversation history.

    * `items` object

      * `role` string

        The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').

      * `tool_call_id` string

        The tool call id. If you don't know what to put here you can fall back to 000000001

      * `content` one of

        * `0` string

          The content of the message as a string.

        * `1` array

          * `items` object

            * `type` string

              Type of the content provided

            * `text` string

            * `image_url` object

              * `url` string

                image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted

        * `2` object

          * `type` string

            Type of the content provided

          * `text` string

          * `image_url` object

            * `url` string

              image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted

  * `functions` array

    * `items` object

      * `name` string required

      * `code` string required

  * `tools` array

    A list of tools available for the assistant to use.

    * `items` one of

      * `0` object

        * `name` string required

          The name of the tool. More descriptive the better.

        * `description` string required

          A brief description of what the tool does.

        * `parameters` object required

          Schema defining the parameters accepted by the tool.

          * `type` string required

            The type of the parameters object (usually 'object').

          * `required` array

            List of required parameter names.

            * `items` string

          * `properties` object required

            Definitions of each parameter.

            * `additionalProperties` object

              * `type` string required

                The data type of the parameter.

              * `description` string required

                A description of the expected parameter.

      * `1` object

        * `type` string required

          Specifies the type of tool (e.g., 'function').

        * `function` object required

          Details of the function tool.

          * `name` string required

            The name of the function.

          * `description` string required

            A brief description of what the function does.

          * `parameters` object required

            Schema defining the parameters accepted by the function.

            * `type` string required

              The type of the parameters object (usually 'object').

            * `required` array

              List of required parameter names.

              * `items` string

            * `properties` object required

              Definitions of each parameter.

              * `additionalProperties` object

                * `type` string required

                  The data type of the parameter.

                * `description` string required

                  A description of the expected parameter.

  * `response_format` object

    * `type` string

    * `json_schema`

  * `guided_json` object

    JSON schema that should be fufilled for the response.

  * `raw` boolean

    If true, a chat template is not applied and you must adhere to the specific model's expected formatting.

  * `stream` boolean

    If true, the response will be streamed back incrementally using SSE, Server Sent Events.

  * `max_tokens` integer default 256

    The maximum number of tokens to generate in the response.

  * `temperature` number default 0.15 min 0 max 5

    Controls the randomness of the output; higher values produce more random results.

  * `top_p` number min 0 max 2

    Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.

  * `top_k` integer min 1 max 50

    Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.

  * `seed` integer min 1 max 9999999999

    Random seed for reproducibility of the generation.

  * `repetition_penalty` number min 0 max 2

    Penalty for repeated tokens; higher values discourage repetition.

  * `frequency_penalty` number min 0 max 2

    Decreases the likelihood of the model repeating the same lines verbatim.

  * `presence_penalty` number min 0 max 2

    Increases the likelihood of the model introducing new topics.

* `2` object

  * `requests` array required

    * `items` one of

      * `0` object

        * `prompt` string required min 1

          The input text prompt for the model to generate a response.

        * `guided_json` object

          JSON schema that should be fulfilled for the response.

        * `response_format` object

          * `type` string

          * `json_schema`

        * `raw` boolean

          If true, a chat template is not applied and you must adhere to the specific model's expected formatting.

        * `stream` boolean

          If true, the response will be streamed back incrementally using SSE, Server Sent Events.

        * `max_tokens` integer default 256

          The maximum number of tokens to generate in the response.

        * `temperature` number default 0.15 min 0 max 5

          Controls the randomness of the output; higher values produce more random results.

        * `top_p` number min 0 max 2

          Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.

        * `top_k` integer min 1 max 50

          Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.

        * `seed` integer min 1 max 9999999999

          Random seed for reproducibility of the generation.

        * `repetition_penalty` number min 0 max 2

          Penalty for repeated tokens; higher values discourage repetition.

        * `frequency_penalty` number min 0 max 2

          Decreases the likelihood of the model repeating the same lines verbatim.

        * `presence_penalty` number min 0 max 2

          Increases the likelihood of the model introducing new topics.

      * `1` object

        * `messages` array required

          An array of message objects representing the conversation history.

          * `items` object

            * `role` string

              The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool').

            * `tool_call_id` string

              The tool call id. If you don't know what to put here you can fall back to 000000001

            * `content` one of

              * `0` string

                The content of the message as a string.

              * `1` array

                * `items` object

                  * `type` string

                    Type of the content provided

                  * `text` string

                  * `image_url` object

                    * `url` string

                      image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted

              * `2` object

                * `type` string

                  Type of the content provided

                * `text` string

                * `image_url` object

                  * `url` string

                    image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted

        * `functions` array

          * `items` object

            * `name` string required

            * `code` string required

        * `tools` array

          A list of tools available for the assistant to use.

          * `items` one of

            * `0` object

              * `name` string required

                The name of the tool. More descriptive the better.

              * `description` string required

                A brief description of what the tool does.

              * `parameters` object required

                Schema defining the parameters accepted by the tool.

                * `type` string required

                  The type of the parameters object (usually 'object').

                * `required` array

                  List of required parameter names.

                  * `items` string

                * `properties` object required

                  Definitions of each parameter.

                  * `additionalProperties` object

                    * `type` string required

                      The data type of the parameter.

                    * `description` string required

                      A description of the expected parameter.

            * `1` object

              * `type` string required

                Specifies the type of tool (e.g., 'function').

              * `function` object required

                Details of the function tool.

                * `name` string required

                  The name of the function.

                * `description` string required

                  A brief description of what the function does.

                * `parameters` object required

                  Schema defining the parameters accepted by the function.

                  * `type` string required

                    The type of the parameters object (usually 'object').

                  * `required` array

                    List of required parameter names.

                    * `items` string

                  * `properties` object required

                    Definitions of each parameter.

                    * `additionalProperties` object

                      * `type` string required

                        The data type of the parameter.

                      * `description` string required

                        A description of the expected parameter.

        * `response_format` object

          * `type` string

          * `json_schema`

        * `guided_json` object

          JSON schema that should be fufilled for the response.

        * `raw` boolean

          If true, a chat template is not applied and you must adhere to the specific model's expected formatting.

        * `stream` boolean

          If true, the response will be streamed back incrementally using SSE, Server Sent Events.

        * `max_tokens` integer default 256

          The maximum number of tokens to generate in the response.

        * `temperature` number default 0.15 min 0 max 5

          Controls the randomness of the output; higher values produce more random results.

        * `top_p` number min 0 max 2

          Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses.

        * `top_k` integer min 1 max 50

          Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises.

        * `seed` integer min 1 max 9999999999

          Random seed for reproducibility of the generation.

        * `repetition_penalty` number min 0 max 2

          Penalty for repeated tokens; higher values discourage repetition.

        * `frequency_penalty` number min 0 max 2

          Decreases the likelihood of the model repeating the same lines verbatim.

        * `presence_penalty` number min 0 max 2

          Increases the likelihood of the model introducing new topics.

### Output

* `0` object

  * `response` string required

    The generated text response from the model

  * `usage` object

    Usage statistics for the inference request

    * `prompt_tokens` number 0

      Total number of tokens in input

    * `completion_tokens` number 0

      Total number of tokens in output

    * `total_tokens` number 0

      Total number of input and output tokens

  * `tool_calls` array

    An array of tool calls requests made during the response generation

    * `items` object

      * `id` string

        The tool call id.

      * `type` string

        Specifies the type of tool (e.g., 'function').

      * `function` object

        Details of the function tool.

        * `name` string

          The name of the tool to be called

        * `arguments` object

          The arguments passed to be passed to the tool call request

* `1` string

## API Schemas

The following schemas are based on JSON Schema

* Input

  ```json
  {
      "type": "object",
      "oneOf": [
          {
              "title": "Ai_Cf_Meta_Llama_4_Prompt",
              "properties": {
                  "prompt": {
                      "type": "string",
                      "minLength": 1,
                      "description": "The input text prompt for the model to generate a response."
                  },
                  "guided_json": {
                      "type": "object",
                      "description": "JSON schema that should be fulfilled for the response."
                  },
                  "response_format": {
                      "title": "JSON Mode",
                      "type": "object",
                      "properties": {
                          "type": {
                              "type": "string",
                              "enum": [
                                  "json_object",
                                  "json_schema"
                              ]
                          },
                          "json_schema": {}
                      }
                  },
                  "raw": {
                      "type": "boolean",
                      "default": false,
                      "description": "If true, a chat template is not applied and you must adhere to the specific model's expected formatting."
                  },
                  "stream": {
                      "type": "boolean",
                      "default": false,
                      "description": "If true, the response will be streamed back incrementally using SSE, Server Sent Events."
                  },
                  "max_tokens": {
                      "type": "integer",
                      "default": 256,
                      "description": "The maximum number of tokens to generate in the response."
                  },
                  "temperature": {
                      "type": "number",
                      "default": 0.15,
                      "minimum": 0,
                      "maximum": 5,
                      "description": "Controls the randomness of the output; higher values produce more random results."
                  },
                  "top_p": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses."
                  },
                  "top_k": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 50,
                      "description": "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises."
                  },
                  "seed": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 9999999999,
                      "description": "Random seed for reproducibility of the generation."
                  },
                  "repetition_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Penalty for repeated tokens; higher values discourage repetition."
                  },
                  "frequency_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Decreases the likelihood of the model repeating the same lines verbatim."
                  },
                  "presence_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Increases the likelihood of the model introducing new topics."
                  }
              },
              "required": [
                  "prompt"
              ]
          },
          {
              "title": "Ai_Cf_Meta_Llama_4_Messages",
              "properties": {
                  "messages": {
                      "type": "array",
                      "description": "An array of message objects representing the conversation history.",
                      "items": {
                          "type": "object",
                          "properties": {
                              "role": {
                                  "type": "string",
                                  "description": "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool')."
                              },
                              "tool_call_id": {
                                  "type": "string",
                                  "description": "The tool call id. If you don't know what to put here you can fall back to 000000001",
                                  "pattern": "[a-zA-Z0-9]{9}"
                              },
                              "content": {
                                  "oneOf": [
                                      {
                                          "type": "string",
                                          "description": "The content of the message as a string."
                                      },
                                      {
                                          "type": "array",
                                          "items": {
                                              "type": "object",
                                              "properties": {
                                                  "type": {
                                                      "type": "string",
                                                      "description": "Type of the content provided"
                                                  },
                                                  "text": {
                                                      "type": "string"
                                                  },
                                                  "image_url": {
                                                      "type": "object",
                                                      "properties": {
                                                          "url": {
                                                              "type": "string",
                                                              "pattern": "^data:*",
                                                              "description": "image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted"
                                                          }
                                                      }
                                                  }
                                              }
                                          }
                                      },
                                      {
                                          "type": "object",
                                          "properties": {
                                              "type": {
                                                  "type": "string",
                                                  "description": "Type of the content provided"
                                              },
                                              "text": {
                                                  "type": "string"
                                              },
                                              "image_url": {
                                                  "type": "object",
                                                  "properties": {
                                                      "url": {
                                                          "type": "string",
                                                          "pattern": "^data:*",
                                                          "description": "image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted"
                                                      }
                                                  }
                                              }
                                          }
                                      }
                                  ]
                              }
                          }
                      }
                  },
                  "functions": {
                      "type": "array",
                      "items": {
                          "type": "object",
                          "properties": {
                              "name": {
                                  "type": "string"
                              },
                              "code": {
                                  "type": "string"
                              }
                          },
                          "required": [
                              "name",
                              "code"
                          ]
                      }
                  },
                  "tools": {
                      "type": "array",
                      "description": "A list of tools available for the assistant to use.",
                      "items": {
                          "type": "object",
                          "oneOf": [
                              {
                                  "properties": {
                                      "name": {
                                          "type": "string",
                                          "description": "The name of the tool. More descriptive the better."
                                      },
                                      "description": {
                                          "type": "string",
                                          "description": "A brief description of what the tool does."
                                      },
                                      "parameters": {
                                          "type": "object",
                                          "description": "Schema defining the parameters accepted by the tool.",
                                          "properties": {
                                              "type": {
                                                  "type": "string",
                                                  "description": "The type of the parameters object (usually 'object')."
                                              },
                                              "required": {
                                                  "type": "array",
                                                  "description": "List of required parameter names.",
                                                  "items": {
                                                      "type": "string"
                                                  }
                                              },
                                              "properties": {
                                                  "type": "object",
                                                  "description": "Definitions of each parameter.",
                                                  "additionalProperties": {
                                                      "type": "object",
                                                      "properties": {
                                                          "type": {
                                                              "type": "string",
                                                              "description": "The data type of the parameter."
                                                          },
                                                          "description": {
                                                              "type": "string",
                                                              "description": "A description of the expected parameter."
                                                          }
                                                      },
                                                      "required": [
                                                          "type",
                                                          "description"
                                                      ]
                                                  }
                                              }
                                          },
                                          "required": [
                                              "type",
                                              "properties"
                                          ]
                                      }
                                  },
                                  "required": [
                                      "name",
                                      "description",
                                      "parameters"
                                  ]
                              },
                              {
                                  "properties": {
                                      "type": {
                                          "type": "string",
                                          "description": "Specifies the type of tool (e.g., 'function')."
                                      },
                                      "function": {
                                          "type": "object",
                                          "description": "Details of the function tool.",
                                          "properties": {
                                              "name": {
                                                  "type": "string",
                                                  "description": "The name of the function."
                                              },
                                              "description": {
                                                  "type": "string",
                                                  "description": "A brief description of what the function does."
                                              },
                                              "parameters": {
                                                  "type": "object",
                                                  "description": "Schema defining the parameters accepted by the function.",
                                                  "properties": {
                                                      "type": {
                                                          "type": "string",
                                                          "description": "The type of the parameters object (usually 'object')."
                                                      },
                                                      "required": {
                                                          "type": "array",
                                                          "description": "List of required parameter names.",
                                                          "items": {
                                                              "type": "string"
                                                          }
                                                      },
                                                      "properties": {
                                                          "type": "object",
                                                          "description": "Definitions of each parameter.",
                                                          "additionalProperties": {
                                                              "type": "object",
                                                              "properties": {
                                                                  "type": {
                                                                      "type": "string",
                                                                      "description": "The data type of the parameter."
                                                                  },
                                                                  "description": {
                                                                      "type": "string",
                                                                      "description": "A description of the expected parameter."
                                                                  }
                                                              },
                                                              "required": [
                                                                  "type",
                                                                  "description"
                                                              ]
                                                          }
                                                      }
                                                  },
                                                  "required": [
                                                      "type",
                                                      "properties"
                                                  ]
                                              }
                                          },
                                          "required": [
                                              "name",
                                              "description",
                                              "parameters"
                                          ]
                                      }
                                  },
                                  "required": [
                                      "type",
                                      "function"
                                  ]
                              }
                          ]
                      }
                  },
                  "response_format": {
                      "title": "JSON Mode",
                      "type": "object",
                      "properties": {
                          "type": {
                              "type": "string",
                              "enum": [
                                  "json_object",
                                  "json_schema"
                              ]
                          },
                          "json_schema": {}
                      }
                  },
                  "guided_json": {
                      "type": "object",
                      "description": "JSON schema that should be fufilled for the response."
                  },
                  "raw": {
                      "type": "boolean",
                      "default": false,
                      "description": "If true, a chat template is not applied and you must adhere to the specific model's expected formatting."
                  },
                  "stream": {
                      "type": "boolean",
                      "default": false,
                      "description": "If true, the response will be streamed back incrementally using SSE, Server Sent Events."
                  },
                  "max_tokens": {
                      "type": "integer",
                      "default": 256,
                      "description": "The maximum number of tokens to generate in the response."
                  },
                  "temperature": {
                      "type": "number",
                      "default": 0.15,
                      "minimum": 0,
                      "maximum": 5,
                      "description": "Controls the randomness of the output; higher values produce more random results."
                  },
                  "top_p": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses."
                  },
                  "top_k": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 50,
                      "description": "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises."
                  },
                  "seed": {
                      "type": "integer",
                      "minimum": 1,
                      "maximum": 9999999999,
                      "description": "Random seed for reproducibility of the generation."
                  },
                  "repetition_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Penalty for repeated tokens; higher values discourage repetition."
                  },
                  "frequency_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Decreases the likelihood of the model repeating the same lines verbatim."
                  },
                  "presence_penalty": {
                      "type": "number",
                      "minimum": 0,
                      "maximum": 2,
                      "description": "Increases the likelihood of the model introducing new topics."
                  }
              },
              "required": [
                  "messages"
              ]
          },
          {
              "title": "Ai_Cf_Meta_Llama_4_Async_Batch",
              "type": "object",
              "properties": {
                  "requests": {
                      "type": "array",
                      "items": {
                          "type": "object",
                          "oneOf": [
                              {
                                  "title": "Ai_Cf_Meta_Llama_4_Prompt_Inner",
                                  "properties": {
                                      "prompt": {
                                          "type": "string",
                                          "minLength": 1,
                                          "description": "The input text prompt for the model to generate a response."
                                      },
                                      "guided_json": {
                                          "type": "object",
                                          "description": "JSON schema that should be fulfilled for the response."
                                      },
                                      "response_format": {
                                          "title": "JSON Mode",
                                          "type": "object",
                                          "properties": {
                                              "type": {
                                                  "type": "string",
                                                  "enum": [
                                                      "json_object",
                                                      "json_schema"
                                                  ]
                                              },
                                              "json_schema": {}
                                          }
                                      },
                                      "raw": {
                                          "type": "boolean",
                                          "default": false,
                                          "description": "If true, a chat template is not applied and you must adhere to the specific model's expected formatting."
                                      },
                                      "stream": {
                                          "type": "boolean",
                                          "default": false,
                                          "description": "If true, the response will be streamed back incrementally using SSE, Server Sent Events."
                                      },
                                      "max_tokens": {
                                          "type": "integer",
                                          "default": 256,
                                          "description": "The maximum number of tokens to generate in the response."
                                      },
                                      "temperature": {
                                          "type": "number",
                                          "default": 0.15,
                                          "minimum": 0,
                                          "maximum": 5,
                                          "description": "Controls the randomness of the output; higher values produce more random results."
                                      },
                                      "top_p": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses."
                                      },
                                      "top_k": {
                                          "type": "integer",
                                          "minimum": 1,
                                          "maximum": 50,
                                          "description": "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises."
                                      },
                                      "seed": {
                                          "type": "integer",
                                          "minimum": 1,
                                          "maximum": 9999999999,
                                          "description": "Random seed for reproducibility of the generation."
                                      },
                                      "repetition_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Penalty for repeated tokens; higher values discourage repetition."
                                      },
                                      "frequency_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Decreases the likelihood of the model repeating the same lines verbatim."
                                      },
                                      "presence_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Increases the likelihood of the model introducing new topics."
                                      }
                                  },
                                  "required": [
                                      "prompt"
                                  ]
                              },
                              {
                                  "title": "Ai_Cf_Meta_Llama_4_Messages_Inner",
                                  "properties": {
                                      "messages": {
                                          "type": "array",
                                          "description": "An array of message objects representing the conversation history.",
                                          "items": {
                                              "type": "object",
                                              "properties": {
                                                  "role": {
                                                      "type": "string",
                                                      "description": "The role of the message sender (e.g., 'user', 'assistant', 'system', 'tool')."
                                                  },
                                                  "tool_call_id": {
                                                      "type": "string",
                                                      "description": "The tool call id. If you don't know what to put here you can fall back to 000000001",
                                                      "pattern": "[a-zA-Z0-9]{9}"
                                                  },
                                                  "content": {
                                                      "oneOf": [
                                                          {
                                                              "type": "string",
                                                              "description": "The content of the message as a string."
                                                          },
                                                          {
                                                              "type": "array",
                                                              "items": {
                                                                  "type": "object",
                                                                  "properties": {
                                                                      "type": {
                                                                          "type": "string",
                                                                          "description": "Type of the content provided"
                                                                      },
                                                                      "text": {
                                                                          "type": "string"
                                                                      },
                                                                      "image_url": {
                                                                          "type": "object",
                                                                          "properties": {
                                                                              "url": {
                                                                                  "type": "string",
                                                                                  "pattern": "^data:*",
                                                                                  "description": "image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted"
                                                                              }
                                                                          }
                                                                      }
                                                                  }
                                                              }
                                                          },
                                                          {
                                                              "type": "object",
                                                              "properties": {
                                                                  "type": {
                                                                      "type": "string",
                                                                      "description": "Type of the content provided"
                                                                  },
                                                                  "text": {
                                                                      "type": "string"
                                                                  },
                                                                  "image_url": {
                                                                      "type": "object",
                                                                      "properties": {
                                                                          "url": {
                                                                              "type": "string",
                                                                              "pattern": "^data:*",
                                                                              "description": "image uri with data (e.g. data:image/jpeg;base64,/9j/...). HTTP URL will not be accepted"
                                                                          }
                                                                      }
                                                                  }
                                                              }
                                                          }
                                                      ]
                                                  }
                                              }
                                          }
                                      },
                                      "functions": {
                                          "type": "array",
                                          "items": {
                                              "type": "object",
                                              "properties": {
                                                  "name": {
                                                      "type": "string"
                                                  },
                                                  "code": {
                                                      "type": "string"
                                                  }
                                              },
                                              "required": [
                                                  "name",
                                                  "code"
                                              ]
                                          }
                                      },
                                      "tools": {
                                          "type": "array",
                                          "description": "A list of tools available for the assistant to use.",
                                          "items": {
                                              "type": "object",
                                              "oneOf": [
                                                  {
                                                      "properties": {
                                                          "name": {
                                                              "type": "string",
                                                              "description": "The name of the tool. More descriptive the better."
                                                          },
                                                          "description": {
                                                              "type": "string",
                                                              "description": "A brief description of what the tool does."
                                                          },
                                                          "parameters": {
                                                              "type": "object",
                                                              "description": "Schema defining the parameters accepted by the tool.",
                                                              "properties": {
                                                                  "type": {
                                                                      "type": "string",
                                                                      "description": "The type of the parameters object (usually 'object')."
                                                                  },
                                                                  "required": {
                                                                      "type": "array",
                                                                      "description": "List of required parameter names.",
                                                                      "items": {
                                                                          "type": "string"
                                                                      }
                                                                  },
                                                                  "properties": {
                                                                      "type": "object",
                                                                      "description": "Definitions of each parameter.",
                                                                      "additionalProperties": {
                                                                          "type": "object",
                                                                          "properties": {
                                                                              "type": {
                                                                                  "type": "string",
                                                                                  "description": "The data type of the parameter."
                                                                              },
                                                                              "description": {
                                                                                  "type": "string",
                                                                                  "description": "A description of the expected parameter."
                                                                              }
                                                                          },
                                                                          "required": [
                                                                              "type",
                                                                              "description"
                                                                          ]
                                                                      }
                                                                  }
                                                              },
                                                              "required": [
                                                                  "type",
                                                                  "properties"
                                                              ]
                                                          }
                                                      },
                                                      "required": [
                                                          "name",
                                                          "description",
                                                          "parameters"
                                                      ]
                                                  },
                                                  {
                                                      "properties": {
                                                          "type": {
                                                              "type": "string",
                                                              "description": "Specifies the type of tool (e.g., 'function')."
                                                          },
                                                          "function": {
                                                              "type": "object",
                                                              "description": "Details of the function tool.",
                                                              "properties": {
                                                                  "name": {
                                                                      "type": "string",
                                                                      "description": "The name of the function."
                                                                  },
                                                                  "description": {
                                                                      "type": "string",
                                                                      "description": "A brief description of what the function does."
                                                                  },
                                                                  "parameters": {
                                                                      "type": "object",
                                                                      "description": "Schema defining the parameters accepted by the function.",
                                                                      "properties": {
                                                                          "type": {
                                                                              "type": "string",
                                                                              "description": "The type of the parameters object (usually 'object')."
                                                                          },
                                                                          "required": {
                                                                              "type": "array",
                                                                              "description": "List of required parameter names.",
                                                                              "items": {
                                                                                  "type": "string"
                                                                              }
                                                                          },
                                                                          "properties": {
                                                                              "type": "object",
                                                                              "description": "Definitions of each parameter.",
                                                                              "additionalProperties": {
                                                                                  "type": "object",
                                                                                  "properties": {
                                                                                      "type": {
                                                                                          "type": "string",
                                                                                          "description": "The data type of the parameter."
                                                                                      },
                                                                                      "description": {
                                                                                          "type": "string",
                                                                                          "description": "A description of the expected parameter."
                                                                                      }
                                                                                  },
                                                                                  "required": [
                                                                                      "type",
                                                                                      "description"
                                                                                  ]
                                                                              }
                                                                          }
                                                                      },
                                                                      "required": [
                                                                          "type",
                                                                          "properties"
                                                                      ]
                                                                  }
                                                              },
                                                              "required": [
                                                                  "name",
                                                                  "description",
                                                                  "parameters"
                                                              ]
                                                          }
                                                      },
                                                      "required": [
                                                          "type",
                                                          "function"
                                                      ]
                                                  }
                                              ]
                                          }
                                      },
                                      "response_format": {
                                          "title": "JSON Mode",
                                          "type": "object",
                                          "properties": {
                                              "type": {
                                                  "type": "string",
                                                  "enum": [
                                                      "json_object",
                                                      "json_schema"
                                                  ]
                                              },
                                              "json_schema": {}
                                          }
                                      },
                                      "guided_json": {
                                          "type": "object",
                                          "description": "JSON schema that should be fufilled for the response."
                                      },
                                      "raw": {
                                          "type": "boolean",
                                          "default": false,
                                          "description": "If true, a chat template is not applied and you must adhere to the specific model's expected formatting."
                                      },
                                      "stream": {
                                          "type": "boolean",
                                          "default": false,
                                          "description": "If true, the response will be streamed back incrementally using SSE, Server Sent Events."
                                      },
                                      "max_tokens": {
                                          "type": "integer",
                                          "default": 256,
                                          "description": "The maximum number of tokens to generate in the response."
                                      },
                                      "temperature": {
                                          "type": "number",
                                          "default": 0.15,
                                          "minimum": 0,
                                          "maximum": 5,
                                          "description": "Controls the randomness of the output; higher values produce more random results."
                                      },
                                      "top_p": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Adjusts the creativity of the AI's responses by controlling how many possible words it considers. Lower values make outputs more predictable; higher values allow for more varied and creative responses."
                                      },
                                      "top_k": {
                                          "type": "integer",
                                          "minimum": 1,
                                          "maximum": 50,
                                          "description": "Limits the AI to choose from the top 'k' most probable words. Lower values make responses more focused; higher values introduce more variety and potential surprises."
                                      },
                                      "seed": {
                                          "type": "integer",
                                          "minimum": 1,
                                          "maximum": 9999999999,
                                          "description": "Random seed for reproducibility of the generation."
                                      },
                                      "repetition_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Penalty for repeated tokens; higher values discourage repetition."
                                      },
                                      "frequency_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Decreases the likelihood of the model repeating the same lines verbatim."
                                      },
                                      "presence_penalty": {
                                          "type": "number",
                                          "minimum": 0,
                                          "maximum": 2,
                                          "description": "Increases the likelihood of the model introducing new topics."
                                      }
                                  },
                                  "required": [
                                      "messages"
                                  ]
                              }
                          ]
                      }
                  }
              },
              "required": [
                  "requests"
              ]
          }
      ]
  }
  ```

* Output

  ```json
  {
      "oneOf": [
          {
              "type": "object",
              "contentType": "application/json",
              "properties": {
                  "response": {
                      "type": "string",
                      "description": "The generated text response from the model"
                  },
                  "usage": {
                      "type": "object",
                      "description": "Usage statistics for the inference request",
                      "properties": {
                          "prompt_tokens": {
                              "type": "number",
                              "description": "Total number of tokens in input",
                              "default": 0
                          },
                          "completion_tokens": {
                              "type": "number",
                              "description": "Total number of tokens in output",
                              "default": 0
                          },
                          "total_tokens": {
                              "type": "number",
                              "description": "Total number of input and output tokens",
                              "default": 0
                          }
                      }
                  },
                  "tool_calls": {
                      "type": "array",
                      "description": "An array of tool calls requests made during the response generation",
                      "items": {
                          "type": "object",
                          "properties": {
                              "id": {
                                  "type": "string",
                                  "description": "The tool call id."
                              },
                              "type": {
                                  "type": "string",
                                  "description": "Specifies the type of tool (e.g., 'function')."
                              },
                              "function": {
                                  "type": "object",
                                  "description": "Details of the function tool.",
                                  "properties": {
                                      "name": {
                                          "type": "string",
                                          "description": "The name of the tool to be called"
                                      },
                                      "arguments": {
                                          "type": "object",
                                          "description": "The arguments passed to be passed to the tool call request"
                                      }
                                  }
                              }
                          }
                      }
                  }
              },
              "required": [
                  "response"
              ]
          },
          {
              "type": "string",
              "contentType": "text/event-stream",
              "format": "binary"
          }
      ]
  }
  ```
