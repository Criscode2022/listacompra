---
name: ai-elements
description: >-
  Build conversation UI in this Angular project with the components in
  src/app/ui/ai-elements: messages, a prompt, suggestions, reasoning, tool
  calls, and sources. Use when the user asks for a chat, an assistant, an
  agent transcript, reasoning, tool calls, or sources, or when a page needs
  those pieces. These components are Angular, built on Spartan. Do not install
  the React AI Elements package, the Vercel AI SDK, or React.
---

# AI elements

Conversation UI lives in `src/app/ui/ai-elements`. The components follow the composition of [AI Elements](https://elements.ai-sdk.dev) and are written for this Angular app. The published package is React-only. Do not add `ai-elements`, `@ai-sdk/*`, React, or Next.js. Add a missing visual piece by composing Spartan (`spartan`), then a small component here.

The Assistant page (`src/app/pages/assistant`) is the working example. It keeps the thread in memory and does not call a model. Copy that shape. Connecting a model is a separate task: follow the secrets and LLM rules in `PROJECT.md`, keep the user's draft when a call fails, and say so in the interface. Do not invent an API key.

## Components

Import each class from its file under `src/app/ui/ai-elements/`. Types live in `ai-role.ts`: `AiRole`, `AiRunStatus`, `AiToolState`, `AiSource`.

| Selector | Use |
| --- | --- |
| `app-ai-conversation` | Scrollable thread. `label` names the viewport (default "Messages"). Project messages or an empty state inside it. |
| `app-ai-message` | One turn. Required `role` (`user` or `assistant`) and `messageId` (stable string). Project the text, and any reasoning, tool, or sources, inside it. |
| `app-ai-prompt` | Signal Form composer. `(submitted)` emits the trimmed text. `status` is `ready`, `submitted`, `streaming`, or `error`. `submitted` and `streaming` disable Send and ignore a second submit. Enter sends. Shift+Enter adds a line. |
| `app-ai-suggestions` | A group of choices. Required `suggestions`. `(selected)` emits the chosen string. |
| `app-ai-reasoning` | Collapsible reasoning. Project the text. `label` defaults to "Show reasoning". `expanded` is a model. |
| `app-ai-tool` | One tool call. Required `name`. `state` is `running`, `completed`, or `error`. Project the detail. |
| `app-ai-sources` | Collapsible links. Required `sources` (`title` and `href`). `expanded` is a model. |

```html
<app-ai-conversation>
  @for (message of messages(); track message.id) {
    <app-ai-message [role]="message.role" [messageId]="message.id">
      <p>{{ message.text }}</p>
      @if (message.reasoning) {
        <app-ai-reasoning>{{ message.reasoning }}</app-ai-reasoning>
      }
    </app-ai-message>
  }
</app-ai-conversation>
<app-ai-suggestions [suggestions]="suggestions" (selected)="ask($event)" />
<app-ai-prompt [status]="status()" (submitted)="ask($event)" />
```

An empty thread uses Spartan's empty state inside the conversation: `hlmEmpty`, `hlmEmptyHeader`, `hlmEmptyTitle`, `hlmEmptyDescription`. Attribute selectors are camelCase. `hlm-empty` does not match.

## Constraints that already broke a build

- `app-ai-conversation` provides `BrnMessageScroller` itself and turns `autoScroll` on. Projected messages cannot see a provider that Helm hangs on an inner host directive. Do not wrap the projected messages in a second scroller provider.
- Put `hlmMessageScrollerItem` on an element inside `app-ai-message`, with `[messageId]`. Do not re-declare that directive through another component's `hostDirectives`. `HlmMessageScrollerItem` has no public `messageId` input to forward, and the compiler reports NG2017.
- A Signal Forms submission `action` must return a Promise. `app-ai-prompt` does. Do not bind `disabled` or `readonly` on a control that has `formField`. Disable the submit button, and return early while `status` is `submitted` or `streaming`.
- The tool name is a paragraph with `hlmCardTitle`. The state badge sits in `hlmCardAction`, which is what places it on the same row. Do not make the name an `h3`: on a page whose last heading is `h1`, that skips a level.

## Check the result

Keyboard: Enter sends, Shift+Enter does not, the error names the empty field, and reasoning and sources open from the keyboard. `ng test` covers the Assistant page's empty state, a suggestion, a typed message, and the blank-message error. axe in light and dark mode when the layout changes.
