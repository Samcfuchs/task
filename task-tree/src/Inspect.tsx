import { useState, useRef, useEffect, useMemo } from 'react'
//import * as d3 from 'd3';
import {type CommitEvent, type TaskMap, type Task} from './App.tsx'

function LittleSwitcher(state) {
  return (

    <></>

    

  )
}

export default function Inspect({tasks, taskID, onCommit} : {tasks: TaskMap, taskID: string, onCommit: (e: CommitEvent) => void}) {

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const currentTask = tasks[taskID];

  useEffect(() => {
    setIsEditing(false);
  }, [taskID]);



  if (!currentTask) return (<></>);

  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: currentTask.id, type: 'uncomplete'} 
      : {id: currentTask.id, type: 'complete'};

    return onCommit(e);
  }


  //console.log(isEditing);

  if (isEditing) {
    return (
      <div id="inspect-pane">
        <div id="bar">
          <input type="checkbox" 
            defaultChecked={currentTask.status == 'complete'} 
            onClick={() => toggleComplete(currentTask)}
            readOnly={true}
          />
          <input className='h1' type='text' defaultValue={currentTask.title}></input>
          <p className='immutable'>{currentTask.id}</p>
        </div>
        <div className='p'>Priority: 
          <input type='number' 
            min='1' max='5' step='1' 
            defaultValue={currentTask.priority} 
            onChange={e => onCommit({id: currentTask.id, type: 'setPriority', value: +e.target.value})}/>
        </div>
        <div><input className='p' type='textarea' defaultValue={currentTask.description}></input></div>
        <input className='p' type='select' defaultValue={currentTask.status}></input>
        <p>External: <input type="checkbox" defaultChecked={currentTask.isExternal}
          onClick={() => onCommit({id: currentTask.id, type:'setIsExternal', value: !currentTask.isExternal})}/></p>
        <p>Blocked: <span className='immutable'>{currentTask.isBlocked.toString() ?? false}</span></p>
        <p className='p'>Dependencies: <span className='immutable'>{currentTask.dependsOn.toString()}</span></p>

        <input type='button' value='Save' onClick={() => setIsEditing(false)}/>
      </div>
    )
  } else {
    return (
      <div id='inspect-pane'>
        <div id='bar'>
          <input type="checkbox" 
            checked={currentTask.status == 'complete'}
            onClick={() => toggleComplete(currentTask)} 
            readOnly={true}/>
          <h1 className='h1'>{currentTask.title}</h1>
          <p className='immutable'>{currentTask.id}</p>
        </div>
        <div className='p'>Priority: {currentTask.priority}</div>
        <p className='p'>{currentTask.description}</p>
        <p className='p'>Status: {currentTask.status}</p>
        <p className='p'>External: <input type="checkbox" checked={currentTask.isExternal}/></p>
        <p>Blocked: <span className='immutable'>{currentTask.isBlocked.toString() ?? false}</span></p>
        <p>Dependencies: <span className='immutable'>{currentTask.dependsOn.toString()}</span></p>


        <input type='button' value='Edit' onClick={() => setIsEditing(true)}/>
        
        
      </div>
    )
  }
}
