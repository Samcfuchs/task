import { type TaskMap } from "./App";
import { getDefaultTask, getSnapshot, insertSnapshot } from "./Domain";


export type Task = {
  id: string,
  title:string,
  description:string,
  priority: number,
  dependsOn: string[],
  status: string,
  isBlocked: boolean,
  isExternal: boolean
}

type Snapshot = {
  snapshot: TaskMap,
  schemaVersion: number,
  
}

//const SERVER_PATH = "http://localhost:8000"
const SERVER_PATH = ""
export const getTasks = getSnapshot;
export const saveTasks = insertSnapshot;

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
    t.dependsOn = Array.from(new Set(t.dependsOn))
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
| { id: string; type: 'unblock'; blockerId: string }
| { id: string; type: 'setIsExternal', value: boolean }
| { id: string; type: 'setPriority', value: number }
| { id: string; type: 'setTitle', value: string }
| { id: string; type: 'setDescription', value: string }
| { id: string; type: 'add', task?}
| { id: string; type: 'delete' }

export function processIntent(event: CommitEvent, prev : TaskMap) : TaskMap {
  const t = prev[event.id];
  console.debug('Previous has task', event.id, ' : ', t);
  console.debug('There is event', event);
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
    case 'setTitle': {
      return {...prev, [event.id]: {...t, title: event.value}}
    }
    case 'setDescription': {
      return {...prev, [event.id]: {...t, description: event.value}}
    }
    case 'setPriority': {
      return {...prev, [event.id]: {...t, priority: event.value}}
    }
    case 'block': {
      if (event.blockerId == t.id) {return prev;} // don't block yourself
      return {...prev, [event.id]: {...t, dependsOn: [...t.dependsOn, event.blockerId]}}
    }
    case 'unblock': {
      if (event.blockerId == t.id) {return prev;} // don't block yourself
      return {...prev, [event.id]: {...t, dependsOn: t.dependsOn.filter(id => id != event.blockerId)}}
    }
    case "add": {
      const def = getDefaultTask(event.id);
      const newTasks = {...prev, [def.id]: {...def, ...event.task}}
      console.log('Commit new tasks including ', def, newTasks);
      return newTasks;
    }
    case "delete": {
      delete prev[event.id];
      for (const childID of Object.keys(prev)) {
        // Remove from dependencies
        prev[childID].dependsOn = prev[childID].dependsOn.filter(v => v != event.id)
      }
      console.log("sanity check after intent", prev);
      return prev
    }

    default: return prev;
  }

}

