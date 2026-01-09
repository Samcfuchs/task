import { useState, useEffect } from 'react'
//import * as d3 from 'd3';
import {type CommitEvent, type TaskMap, type Task} from './App.tsx'
import Markdown from 'react-markdown';


export function Inspect({tasks, taskID, selectTask, onCommit} 
  : {tasks: TaskMap, taskID: string, selectTask : (string) => void, onCommit: (e: CommitEvent) => void}) {

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
        <p className='immutable'>{currentTask.id}</p>

        <input type='button' value='Save' onClick={() => setIsEditing(false)}/>
      </div>
    )
  } else {
    return (
      <div id='inspect-pane'>
        <div id='bar'>
          <CheckBox task={currentTask}/>
          <TextWidget key={'title'+currentTask.id} defaultValue={currentTask.title} onBlur={commitFn('setTitle')}/>
          <ExternalModal key={'ext'+currentTask.id} defaultValue={currentTask.isExternal} update={commitFn('setIsExternal')}/>
          <PriorityModal key={'priority'+currentTask.id} defaultValue={currentTask.priority} update={commitFn('setPriority')}/>
        </div>

        <MarkdownWidget key={'desc'+currentTask.id} 
          defaultValue={currentTask.description} 
          onBlur={commitFn('setDescription')} 
        />

        <DependencyView key={'dep'+currentTask.id} task={currentTask} selectTask={selectTask} allTasks={tasks} onCommit={onCommit}/>
        <p className='p'>Status: {currentTask.status}</p>
        <p className='immutable'>{currentTask.id}</p>


        <input type='button' value='Delete' onClick={() => onCommit({id: currentTask.id, type: 'delete'} )}/>
        
        
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

function MarkdownWidget({defaultValue, onBlur, placeholderText="Description"}) {
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

          defaultValue ? 

            <Markdown>{defaultValue}</Markdown>
          :
          
          <p>{placeholderText}</p>
      }
    
    </div>
    
  )
}

type ModalOption = {
  text: string,
  color: string,
}

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

const priorityColors = {
  1: '#CF0F0F',
  2: '#ff2289ff',
  3: '#F79A19',
  4: '#5413bbff',
  5: '#6A2C70',
  0: '#777',
}

function PriorityModal({defaultValue, update}) {
  // This function is only stupid because I decided to 1-index priority. bad idea.
  function clickIncrement(v:number) : number { return (mod(defaultValue-2, 5)); }
  
  return (
    <div className='modal priority button' 
      onClick={e => update(clickIncrement(defaultValue)+1) }
      style={{backgroundColor:priorityColors[defaultValue]}}
    ><span>
      {
        '!'.repeat(6 - defaultValue)
      }
    </span>
    </div>
  )
}

function ExternalModal({defaultValue, update}) {
  return (
    <div className='modal external button' 
      onClick={e => update(!defaultValue) }
      style={{
        backgroundColor: (defaultValue ? '#55f' : '#222'),
        borderRadius: defaultValue ? '5px' : '25px'

      }}
    ><span> External </span>
    </div>
  )

}


function DependencyView({task, selectTask, allTasks, onCommit} 
  : {task : Task, selectTask : (string) => void, allTasks:TaskMap, onCommit}) {

  function DependencyWidget({parent} : {parent : Task}) {
    return (
      <span onClick={e => selectTask(parent.id)}>{parent.title}
      <button className='delete' onClick={e => {
        e.stopPropagation();
        onCommit({id:task.id, type:'unblock', blockerId:parent.id})}
      }>x</button></span>
        
    )
  }

  return (
    <div className='dependencies'>
      {
        task.dependsOn.map(parentID => {
          return  <DependencyWidget parent={allTasks[parentID]}/>
        })
      }
    </div>
  )
}

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
