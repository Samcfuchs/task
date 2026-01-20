import type { TaskMap } from "./App";
import { supabase } from "./lib/supabase/client";
import { type CommitEvent, type Task } from "./Tasks";
import { nanoid } from "nanoid";

export type TaskUpdate = {
  id: string,
  title?:string,
  description?:string,
  priority?: number,
  status?: string,
  isExternal?: boolean

  addDeps?: string[],
  removeDeps?: string[]
}

type DomainEvent =
  | { id: string, type: 'create', task: Task }
  | { id: string, type: 'delete' }
  | { id: string, type: 'update', task_update: TaskUpdate }
;

const EVENTS_TABLE_NAME = 'task_events'

export const generateID = () => nanoid(8);

export const getDefaultTask = (id : string | null) : Task => ({
  title: "Untitled task",
  id: id ?? generateID(),
  description: "",
  priority: 3,
  dependsOn: [],
  status: 'not started',
  isBlocked: false,
  isExternal: false
});

let EVENT_QUEUE : DomainEvent[] = []
export const dumpQueue = () => {

    try {
        insertEvents(EVENT_QUEUE);
    } catch {
        return
    }

    // If successful, empty the queue
    EVENT_QUEUE = []
}

export const notifyCommits = (commits: CommitEvent[]) => {
    EVENT_QUEUE.push(...reduceCommitEvent(commits));
}

function reduceCommitEvent(commits: CommitEvent[]): DomainEvent[] {
  const events: DomainEvent[] = []

  for (const c of commits) {
    switch (c.type) {
      case 'add': {

        const task = c.task ?? getDefaultTask(c.id ?? null)
        events.push({ id: task.id, type: 'create', task })

        break
      }

      case 'delete': {
        events.push({ id: c.id, type: 'delete' })
        break
      }

      case 'complete': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, status: 'complete' }
        })
        break
      }

      case 'uncomplete': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, status: 'not started' }
        })
        break
      }

      case 'setTitle': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, title: c.value }
        })
        break
      }

      case 'setDescription': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, description: c.value }
        })
        break
      }

      case 'setPriority': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, priority: c.value }
        })
        break
      }

      case 'setIsExternal': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: { id: c.id, isExternal: c.value }
        })
        break
      }

      case 'block': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: {
            id: c.id,
            addDeps: [c.blockerId]
          }
        })
        break
      }

      case 'unblock': {
        events.push({
          id: c.id,
          type: 'update',
          task_update: {
            id: c.id,
            removeDeps: [c.blockerId]
          }
        })
        break
      }

      default: {
        // exhaustiveness guard
        const _exhaustive: never = c
        throw new Error(`Unhandled CommitEvent: ${_exhaustive}`)
      }
    }
  }

  return events
}

function insertEvents(events: DomainEvent[]) {
    const rows = events.map(e => ({
            task_id: e.id,
            type: e.type,
            payload:
                e.type === 'create' ? e.task :
                e.type === 'update' ? e.task_update :
                {}
        }))
    
    const { error } = supabase.from(EVENTS_TABLE_NAME)
        .insert(rows);
    
    if (error) {
        console.error('Failed to insert events', error);
        throw error;
    }
    
}

export async function insertSnapshot(tasks: TaskMap) {

    const rows = {
        snapshot: tasks,
        schema_version: 1
    }

    const { error } = await supabase.from('tasks').insert(rows);

    if (error) {
        console.error('Failed to insert snapshot', error);
        throw error;
    }
}

export async function getSnapshot() : Promise<TaskMap> {

    const {data, error} = await supabase.from('tasks')
        .select('*')
        .order('created_at', { ascending : false })
        .limit(1)
        .single();
    
    console.log("Retrieved snapshot", data.snapshot)
    if (error) {
        console.error('Failed to insert snapshot', error);
        throw error;
    }


    return data.snapshot;


}

