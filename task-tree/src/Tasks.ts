import { type TaskMap } from "./App";


export type Task = {
  title:string,
  id: string,
  description:string,
  priority: number,
  dependsOn: string[],
  status: string,
  isBlocked: boolean,
  isExternal: boolean
}

const SERVER_PATH = "http://localhost:8000"

export function saveTasks(tasks: TaskMap) {
  return async () => {
    const snapshot = {
      schemaVersion: 1,
      tasks
    }

    await fetch(SERVER_PATH + "/api/save", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        //'Accept': 'application/json',
      },
      body: JSON.stringify(snapshot)
    });
  };
}

export async function getTasks() : Promise<{snapshot : TaskMap}> {
  return fetch(SERVER_PATH + "/api/load", { 
    method: "GET",
    headers: {
      //"Content-Type": "application/json",
      "Access-Control-Allow-Origin": "true"
    }
  }).then(res => res.json())
}

export function calculate(tasks : Record<string, Task>) : Record<string, Task> {
  const next: Record<string, Task> = {}

  /** Checks for deep completeness--the task and all its parents must be complete */
  function isComplete(task: Task) {
    if (task.status != 'complete') return false;

    for (const dep of task.dependsOn) {
      if (!isComplete(tasks[dep])) return false;
    }
    return true;

  }

  for (const [id, t] of Object.entries(tasks)) {
    let isBlocked = false;
    let status = t.status;
    for (const dep of t.dependsOn) {
      //if (tasks[dep].status !== 'complete') {
      if (!isComplete(tasks[dep])) {
        isBlocked = true;
        status = 'not started';
        break;
      }
    }

    const isExternal = t.isExternal ?? false

    next[id] = {
      ...t,
      isBlocked: isBlocked,
      isExternal: isExternal,
      status: status
    };

  }

  console.debug("Recalculated:", next);
  return next
}

export type CommitEvent =
| { id: string; type: 'complete' }
| { id: string; type: 'uncomplete'; }

| { id: string; type: 'block'; blockerId: string }
| { id: string; type: 'setIsExternal', value: boolean }
| { id: string; type: 'setPriority', value: number }

| { id: string; type: 'delete' }


export function processIntent(event: CommitEvent, prev : TaskMap) : TaskMap {
  const t = prev[event.id];
  console.log(t);
  switch (event.type) {
    case 'complete': {

      if (t.isBlocked) {
        console.warn('commit fails', event, t);
        return prev;
      }

      return { ...prev, [event.id]: {...t, status: 'complete' } }
    }
    case 'uncomplete': {
      const t = prev[event.id];
      const curr = prev;
      curr[event.id] = {...t, status:'not started'}
      return { ...prev, [event.id]: {...t, status: 'not started' } }
    }
    case 'setIsExternal': {
      return {...prev, [event.id]: {...t, isExternal: event.value}}
    }
    case 'setPriority': {
      return {...prev, [event.id]: {...t, priority: event.value}}
    }

    default: return prev;
  }

}

