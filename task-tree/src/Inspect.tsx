import { useState, useEffect } from 'react'
//import * as d3 from 'd3';
import {type CommitEvent, type TaskMap, type Task} from './App.tsx'
import Markdown from 'react-markdown';


export function Inspect({tasks, taskID, onCommit} : {tasks: TaskMap, taskID: string, onCommit: (e: CommitEvent) => void}) {

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


  function commitFn(commitType: string) {
    return (v) => onCommit({id: currentTask.id, type: commitType, value: v})
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
        <input type='button' value='Delete' onClick={() => onCommit({id: currentTask.id, type: 'delete'} )}/>
      </div>
    )
  } else {
    return (
      <div id='inspect-pane'>
        <div id='bar'>
          <CheckBox task={currentTask}/>
          <TextWidget key={currentTask.id} defaultValue={currentTask.title} onBlur={commitFn('setTitle')}/>
          <p className='immutable'>{currentTask.id}</p>
        </div>
        <MarkdownWidget key={currentTask.id} defaultValue={currentTask.description} 
          onBlur={commitFn('setDescription')} 

        />
        <div className='p'>Priority: {currentTask.priority}</div>
        <p className='p'>{currentTask.description}</p>
        <p className='p'>Status: {currentTask.status}</p>
        <p className='p'>External: <input type="checkbox" checked={currentTask.isExternal}/></p>
        <p>External: <input type="checkbox" defaultChecked={currentTask.isExternal}
          onClick={() => onCommit({id: currentTask.id, type:'setIsExternal', value: !currentTask.isExternal})}/></p>
        <p className='p'>Blocked: <span className='immutable'>{currentTask.isBlocked.toString() ?? false}</span></p>
        <p className='p'>Dependencies: <span className='immutable'>{currentTask.dependsOn.toString()}</span></p>


        <input type='button' value='Edit' onClick={() => setIsEditing(true)}/>
        
        
      </div>
    )
  }
}

export function Tooltip({tasks, taskID} : {tasks: TaskMap, taskID: string | undefined}) {

  if (taskID == undefined) return (<div id='tooltip'></div>)
  if (!tasks[taskID]) return (<div id='tooltip'></div>)
    

  return (
    <div id='tooltip'>
      <h1>{tasks[taskID].title}</h1>
    </div>
  )
}

function TextWidget({defaultValue, onBlur}) {

  return (
    <input type='text' className='text-widget' 
      defaultValue={defaultValue}
      onBlur={e => {if (e.target.value != defaultValue) {onBlur(e.target.value)}}}/>
  )
}

function MarkdownWidget({defaultValue, onBlur}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className={'markdown-widget' + (editing ? ' editing' : '')}  onClick={e => setEditing(true)}>
      { editing ?
        <textarea name="description" 
          defaultValue={defaultValue}
          autoFocus
          onBlur={e => {
            if (e.target.value != defaultValue) {onBlur(e.target.value)} 
            setEditing(false);

          }}
        />
        
        :

        <Markdown>{defaultValue}</Markdown>
      }
    
    </div>
    
  )
}

function Modal({options} : {options : string[]}) {}

function CheckBox({task} : {task: Task}) {

  const radii = [100, 80, 60, 40, 20];
  //const 
  // const borderRadius = task.isExternal ? 3 : 20;
  const [cx,cy] = [50,50]
  const getCircle = r => (
    <rect 
        className='target'
        stroke='white' 
        strokeWidth='6'
        fill='#fff'
        fillOpacity='0'
        height={r}
        width={r}
        x={cx -r/2}
        y={cy - r/2}
        rx={task.isExternal ? 3 : r}
        ry={task.isExternal ? 3 : r}
      ></rect>
  )
  return (

    <svg className='checkbox' viewBox="0 0 100 100">
      {radii.slice(task.priority).map(getCircle)}
    </svg>
  )
}
