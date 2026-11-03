/**
 * WebMCP template: lets AI agents in the browser use this app through tools. Off by default.
 * Nothing imports this file, and it sits outside `src/`, so `ng build` and `ng test` ignore it.
 * Copy the parts you need into `src/`. README.md ("WebMCP template") explains each step and why
 * the API is experimental.
 */
import {
  type ApplicationConfig,
  Component,
  declareExperimentalWebMcpTool,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideExperimentalWebMcpTools,
  Service,
  signal,
} from '@angular/core';
import {
  form,
  FormField,
  FormRoot,
  provideExperimentalWebMcpForms,
  required,
} from '@angular/forms/signals';
import { provideRouter, type Routes, withAutoCleanupInjectors } from '@angular/router';
import type { NoteDraft } from '../src/app/features/notes/note.model';
import { NotesRepository } from '../src/app/features/notes/notes-repository';

// 1. App-wide tools with provideExperimentalWebMcpTools: registered when the app starts and
//    unregistered when it is destroyed. `execute` runs in an injection context, so call inject()
//    before the first `await`.
const appTools = provideExperimentalWebMcpTools([
  {
    name: 'listNotes',
    description: 'Lists the titles of the saved notes, one per line.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const notes = await inject(NotesRepository).list();
      return notes.map((note) => note.title).join('\n') || 'There are no notes yet.';
    },
  },
]);

// 2. Route-scoped tools: exist only while the route is active. Angular infers the argument
//    types from `inputSchema`, but it does not validate what the agent sends, so check it.
const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('../src/app/pages/home/home').then((m) => m.Home),
    providers: [
      provideExperimentalWebMcpTools([
        {
          name: 'searchNotes',
          description: 'Finds saved notes whose title contains the query.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Text to look for in note titles.' },
            },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true },
          execute: async ({ query }) => {
            if (typeof query !== 'string' || query.trim() === '') {
              throw new Error('query must be a non-empty string.');
            }
            const notes = await inject(NotesRepository).list();
            const needle = query.toLowerCase();
            const matches = notes.filter((note) => note.title.toLowerCase().includes(needle));
            return matches.map((note) => note.title).join('\n') || `No notes match "${query}".`;
          },
        },
      ]),
    ],
  },
];

// 3. A tool declared inside a root service with declareExperimentalWebMcpTool. It is registered
//    when the service is first created and removed when its injector is destroyed. Tool names
//    must be unique, so prefer root services over components that can render more than once.
@Service()
export class NotesAgentTools {
  private readonly repository = inject(NotesRepository);

  constructor() {
    declareExperimentalWebMcpTool({
      name: 'countNotes',
      description: 'Counts the saved notes.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => `There are ${(await this.repository.list()).length} notes.`,
    });
  }
}

// 4. A Signal Form exposed as a tool with `experimentalWebMcpTool`. Angular infers the JSON
//    schema from the model's initial value, so give every field a concrete value ('' or 0, never
//    null). The agent sees validation errors and submission failures, so it can correct itself.
//    Async validators do not run for agent calls; validate in the submission action instead.
//    Render this component at most once at a time.
@Component({
  selector: 'app-agent-note-form',
  imports: [FormField, FormRoot],
  template: `
    <form [formRoot]="noteForm">
      <label for="agent-note-title">New note</label>
      <input id="agent-note-title" type="text" [formField]="noteForm.title" />
      <button type="submit">Add note</button>
    </form>
  `,
})
export class AgentNoteForm {
  private readonly repository = inject(NotesRepository);
  private readonly draft = signal<NoteDraft>({ title: '' });

  protected readonly noteForm = form(
    this.draft,
    (note) => {
      required(note.title, { message: 'Enter a title for the note.' });
    },
    {
      experimentalWebMcpTool: {
        name: 'addNote',
        description: 'Adds a note with the given title.',
        // Tells the browser agent this changes data, so it should confirm with the user first.
        annotations: { consequentialHint: true },
      },
      submission: {
        action: async (noteForm) => {
          await this.repository.add(noteForm().value());
        },
      },
    },
  );
}

// 5. Wiring, for reference. The real app config (src/app/app.config.ts) registers no tools.
//    withAutoCleanupInjectors() destroys a route's injector after the user navigates away, which
//    unregisters that route's tools. Without it, route tools stay available to agents.
export const webMcpExampleConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withAutoCleanupInjectors()),
    appTools,
    // Required before any Signal Form's `experimentalWebMcpTool` registers a tool.
    provideExperimentalWebMcpForms(),
    // Root services are created lazily. Inject this one at startup so its tool registers.
    provideAppInitializer(() => {
      inject(NotesAgentTools);
    }),
  ],
};
