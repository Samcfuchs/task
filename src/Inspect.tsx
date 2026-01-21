import { useState, useEffect } from 'react'
//import * as d3 from 'd3';
import { type TaskMap } from './App.tsx'
import { type CommitEvent, type Task } from './Tasks.ts';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardContent, CardHeader } from '@/components/ui/card';
import '@/styles/Inspect.css';
import { Toggle } from './components/ui/toggle.tsx';
import { ImCross } from 'react-icons/im';


export function Inspect({tasks, taskID, selectTask, onCommit} 
  : {tasks: TaskMap, taskID: string, selectTask : (string) => void, onCommit: (e: CommitEvent) => void}) {

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const currentTask = tasks[taskID];

  useEffect(() => {
    setIsEditing(false);
  }, [taskID]);


  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: t.id, type: 'uncomplete'} 
      : {id: t.id, type: 'complete'};


    return onCommit(e);
  }


  if (!currentTask) return (<></>);


  function commitFn(commitType: string) {
    return (v) => onCommit({id: currentTask.id, type: commitType, value: v})
  }

  //console.log(isEditing);

  return (
    <div id='inspect-pane'>
      <div id='bar'>
        <CheckBox task={currentTask} onClick={toggleComplete}/>
        <TextWidget key={'title'+currentTask.id} defaultValue={currentTask.title} onBlur={commitFn('setTitle')}/>
        <ExternalModal key={'ext'+currentTask.id} defaultValue={currentTask.isExternal} update={commitFn('setIsExternal')}/>
        <PriorityModal key={'priority'+currentTask.id} defaultValue={currentTask.priority} update={commitFn('setPriority')}/>
      </div>

      <MarkdownWidget key={'desc'+currentTask.id} 
        defaultValue={currentTask.description} 
        onBlur={commitFn('setDescription')} 
      />

      <DependencyView key={'dep'+currentTask.id} task={currentTask} selectTask={selectTask} allTasks={tasks} onCommit={onCommit}/>


      <div id='buttonbar'>
        <button onClick={() => {
          onCommit({id: currentTask.id, type: 'delete'});
          selectTask(null);
        }}>Delete</button>
        
        <button onClick={() => {
          selectTask(null);
        }}>Escape
        </button>

        <Button variant='destructive' onClick={() => {
          onCommit({id: currentTask.id, type: 'delete'});
          selectTask(null);
        }}>Delete</Button>
      
      </div>
      
    </div>
  )
}

export function InspectNew({tasks, taskID, selectTask, onCommit}) {
  const currentTask = tasks[taskID];
  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: t.id, type: 'uncomplete'} 
      : {id: t.id, type: 'complete'};


    return onCommit(e);
  }
  function commitFn(commitType: string) {
    return (v) => onCommit({id: currentTask.id, type: commitType, value: v})
  }


  return (
    <Card className="test" id='inspect-pane-new'>
      <CardHeader className='card-header'>
        <div id='bar'>
          <CheckBox task={currentTask} onClick={toggleComplete}/>
          <TextWidget key={'title'+currentTask.id} defaultValue={currentTask.title} onBlur={commitFn('setTitle')}/>
          <Toggle className='external modal px-8' variant='outline' size='lg' 
            pressed={currentTask.isExternal}
            onPressedChange={commitFn('setIsExternal')}>External</Toggle>
          <PriorityModal key={'priority'+currentTask.id} defaultValue={currentTask.priority} update={commitFn('setPriority')}/>
        </div>

      </CardHeader>
      <CardContent>
      <MarkdownWidget key={'desc'+currentTask.id} 
        defaultValue={currentTask.description} 
        onBlur={commitFn('setDescription')} 
      />
      <DependencyView task={currentTask} allTasks={tasks} selectTask={selectTask} onCommit={onCommit} />


      </CardContent>

      <CardFooter>
        <Button variant='outline' size='lg' onClick={() => {
          selectTask(null);
        }}>Submit</Button>

        <Button variant='destructive' size='lg' 
          onClick={() => {
          onCommit({id: taskID, type: 'delete'});
          selectTask(null);
        }}>Delete</Button>
      
      </CardFooter>
      <Button className='delete rounded-full' size='icon' 
        onClick={e => {
          e.stopPropagation();
          selectTask(null);
        }}
      >
        <XIcon size='sm' strokeWidth='5' height='2px'/>
      </Button>
    </Card>
  )
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
    <Button onClick={e => update(clickIncrement(defaultValue)+1)}
      style={{backgroundColor: priorityColors[defaultValue]}}
      size='lg'
      className='modal priority'
    ><span>{ '!'.repeat(6 - defaultValue) }</span></Button>
  )
  
  return (
    <div className='modal priority button' 
      onClick={e => update(clickIncrement(defaultValue)+1) }
      style={{backgroundColor:priorityColors[defaultValue]}}
    >
      <span> { '!'.repeat(6 - defaultValue) } </span>
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


import { XIcon } from "lucide-react"
function DependencyView({task, selectTask, allTasks, onCommit} 
  : {task : Task, selectTask : (string) => void, allTasks:TaskMap, onCommit}) {

  function DependencyWidget({parent} : {parent : Task}) {
    return (
      <span onClick={e => selectTask(parent.id)}>{parent.title}
      <Button className='delete rounded-full' size='icon' 
        onClick={e => {
          e.stopPropagation();
          onCommit({id:task.id, type:'unblock', blockerId:parent.id})}
      }>

        <XIcon size='sm' strokeWidth='5' height='2px'/>
      
      
      </Button></span>
        
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

function CheckBox({task, onClick} : {task : Task, onClick : (t : Task) => void}) {

  const radii = [100, 80, 60, 40, 20];
  //const 
  // const borderRadius = task.isExternal ? 3 : 20;
  const [cx,cy] = [50,50]
  const getCircle = r => (
    <rect 
        className='target'
        //stroke='white' 
        strokeWidth='6'
        //fill='#fff'
        fillOpacity='0'
        height={r}
        width={r}
        x={cx -r/2}
        y={cy - r/2}
        rx={task.isExternal ? 10 : r}
        ry={task.isExternal ? 10 : r}
      ></rect>
  )
  const getCross = r => (<g>
    <line
      x1={cx - r/2}
      x2={cx + r/2}
      y1={cy - r/2}
      y2={cy + r/2}
      className='stroke-(--background)'
      strokeWidth='20'
      strokeLinecap='round'
    ></line>
    <line
      x1={cx + r/2}
      x2={cx - r/2}
      y1={cy - r/2}
      y2={cy + r/2}
      className='stroke-(--background)'
      strokeWidth='20'
      strokeLinecap='round'
    ></line>
    <line
      x1={cx - r/2}
      x2={cx + r/2}
      y1={cy - r/2}
      y2={cy + r/2}
      className='stroke-(--foreground)'
      strokeWidth='6'
      strokeLinecap='round'
    ></line>
    <line
      x1={cx + r/2}
      x2={cx - r/2}
      y1={cy - r/2}
      y2={cy + r/2}
      className='stroke-(--foreground)'
      strokeWidth='6'
      strokeLinecap='round'
    ></line>
  </g>)
  return (

    <svg className='checkbox stroke-(--foreground) fill-(--foreground) ' 
      viewBox="0 0 100 100" 
      onClick={(e) => {onClick(task); e.stopPropagation()}}>
      {/*radii.slice(task.priority).map(getCircle)*/}
      {getCircle(radii[1])}
      { task.status == 'complete' ?
        getCross(radii[1])
        :
        undefined
      }
    </svg>
  )
}

export function ListView({tasks, selectTask, onCommit}) {

  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: t.id, type: 'uncomplete'} 
      : {id: t.id, type: 'complete'};


    return onCommit(e);
  }


  function ListItem({task} : {task: Task}) {
    return (
      <div className='list-item' onClick={e => selectTask(task.id)}>
        <CheckBox task={task} onClick={toggleComplete}></CheckBox>
        <span>{task.title}</span>
        <PriorityModal defaultValue={task.priority} 
          update={n => onCommit({id:task.id, type: 'setPriority', value: n})}/>
      </div>
    )
  }

  function filter(task) : boolean {
    return (task.status != 'complete');
  }

  function sort(task1, task2) : number {
    return -(task2.priority - task1.priority);
  }

  return (
    <div id='list-view'>
      {
        Object.values(tasks)
          .filter(filter)
          .sort(sort)
          .map(t => <ListItem task={t}/>)
      }


    </div>
  )
}
