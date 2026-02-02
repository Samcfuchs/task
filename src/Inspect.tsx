import { useEffect, useMemo, useRef, useState } from 'react'
//import * as d3 from 'd3';
import { COLORS, type TaskMap } from './App.tsx'
import { type CommitEvent, type Task } from './Tasks.ts';
import Markdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardFooter, CardContent, CardHeader } from '@/components/ui/card';
import '@/styles/Inspect.css';
import '@/styles/ListView.css';
import { Toggle } from './components/ui/toggle.tsx';
import Select from 'react-select';

export function Inspect({tasks, taskID, selectTask, onCommit, addDependencyTask, setAddDependencyTask}) {
  const currentTask : Task = tasks[taskID];
  if (!currentTask) { return (<div id='inspect-pane-new'></div>) }

  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: t.id, type: 'uncomplete'} 
      : {id: t.id, type: 'complete'};


    return onCommit(e);
  }
  function commitFn(commitType: string) {
    return (v) => onCommit({id: currentTask.id, type: commitType, value: v})
  }


  const selectOptions = Object.values(tasks).map(t => ({
    value: t.id,
    label: t.title
  }))


  function handleChange(newDeps, change) {
    switch (change.action) {
      case 'select-option':
        onCommit({id: taskID, type: 'block', blockerId:change.option.value})
        break
      case 'remove-value':
        onCommit({id: taskID, type: 'unblock', blockerId:change.removedValue.value})
        break
      case 'pop-value':
        onCommit({id: taskID, type: 'unblock', blockerId:change.removedValue.value})
        break
      case 'deselect-option':
        onCommit({id: taskID, type: 'unblock', blockerId:change.option.value})
        break
      default:
        console.log(newDeps, change);
    }


  }
  
  

  //let defaultValues = selectOptions.filter(o => currentTask.dependsOn.includes(o.value))


  
  return (
    <Card className="test" id='inspect-pane-new'>
      <CardHeader className='card-header'>
        <div id='bar'>
          <div>
            <CheckBox task={currentTask} onClick={toggleComplete}/>
            <TextWidget key={'title'+currentTask.id} defaultValue={currentTask.title} onBlur={commitFn('setTitle')}/>
          </div>
          <div>
          <Toggle className='external modal px-8' variant='outline' size='lg' 
            pressed={currentTask.isExternal}
            onPressedChange={commitFn('setIsExternal')}>External</Toggle>
          <PriorityModal key={'priority'+currentTask.id} defaultValue={currentTask.priority} update={commitFn('setPriority')}/>
          </div>
        </div>

      </CardHeader>
      <CardContent>
      <Label htmlFor='select'>Dependencies</Label>
      <Select options={selectOptions.filter(o => currentTask.id != o.value)} 
        key={taskID}
        defaultValue={selectOptions.filter(o => currentTask.dependsOn.includes(o.value)) }
        closeMenuOnSelect={false}
        onChange={handleChange}
        isMulti
        styles={{
          menu: (baseStyles, state) => ({...baseStyles, fontSize: '.7em'}),
          option: (baseStyles, state) => ({...baseStyles, padding: '5px 5px'}),
          multiValue: (baseStyles, state) => ({...baseStyles, borderRadius: '5px'}),
          multiValueRemove: (baseStyles, state) => ({...baseStyles, paddingLeft: '6px',paddingRight:'6px'})
        }}
      />

      <MarkdownWidget key={'desc'+currentTask.id} 
        defaultValue={currentTask.description} 
        onBlur={commitFn('setDescription')} 
      />
      {/* <DependencyView task={currentTask} allTasks={tasks} selectTask={selectTask} onCommit={onCommit} setAddDependencyTaskID={setAddDependencyTask}/> */}
      </CardContent>

      <CardFooter>
        <Button variant='outline'  onClick={() => { selectTask(null); }}>
          Submit
        </Button>

        <Button variant='destructive' //size='lg' 
          onClick={() => {
          onCommit({id: taskID, type: 'delete'});
          selectTask(null);
        }}>Delete</Button>
        <Button variant='outline' onClick={() => selectTask(null)}>Exit</Button>
      
      </CardFooter>
    </Card>
  )
}

export function Tooltip({tasks, taskID} : {tasks: TaskMap, taskID: string | undefined}) {

  if (taskID == undefined) return (<div id='tooltip'></div>)
  if (!tasks[taskID]) return (<div id='tooltip'></div>)
  
  const currentTask = tasks[taskID];
    

  return (
    <Card id='tooltip' className='tooltip'>
      <CardContent>
          <span>{tasks[taskID].title}</span>
          
          <PriorityModal key={'priority'+currentTask.id} defaultValue={currentTask.priority} update={null}/>
      </CardContent>
    </Card>
  )
}

function TextWidget({defaultValue, onBlur}) {

  return (
    <input type='text' className='text-widget' 
      defaultValue={defaultValue}
      onBlur={e => {if (e.target.value != defaultValue) {onBlur(e.target.value)}}}/>
  )
}

//TODO : Re-engineer dynamic markdown widget
function MarkdownWidget({defaultValue, onBlur, placeholderText="Description"}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className={'markdown-widget' + (editing ? ' editing' : '')}  
      onClick={e => setEditing(true)}
      tabIndex={0}
      onFocus={e=>setEditing(true)}>
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
}


import { ArrowUpDownIcon, CheckIcon, CircleIcon, FilterIcon, SquareIcon, XIcon } from "lucide-react"
import { Label } from './components/ui/label.tsx';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from './components/ui/dropdown-menu.tsx';
import { BsExclamation } from 'react-icons/bs';

function CheckBox({task, onClick} : {task : Task, onClick : (t : Task) => void}) {

  const radii = [100, 80, 60, 40, 20];
  //const 
  // const borderRadius = task.isExternal ? 3 : 20;
  const [cx,cy] = [50,50]
  const getCircle = r => (
    <rect 
        className='target'
        //stroke='white' 
        strokeWidth='10'
        //fill='#fff'
        fillOpacity='0'
        height={r}
        width={r}
        x={cx -r/2}
        y={cy - r/2}
        rx={task.isExternal ? 20 : r}
        ry={task.isExternal ? 20 : r}
      ></rect>
  )
  const gap = 30;
  const getFill = r => (
    <rect 
        className='target'
        stroke='#3a3' 
        strokeWidth='2'
        fill='#9f9'
        fillOpacity='1'
        height={r-gap}
        width={r-gap}
        x={cx -(r-gap)/2}
        y={cy - (r-gap)/2}
        rx={task.isExternal ? 20 - (gap/2) : (r-gap)}
        ry={task.isExternal ? 20 - (gap/2): (r-gap)}
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

    <svg className={'checkbox fill-(--foreground) '+ (task.isBlocked ? 'stroke-(--muted-foreground)' : 'stroke-(--foreground)') } 
      viewBox="0 0 100 100" 
      onClick={(e) => {
          if (!task.isBlocked) onClick(task); 
          e.stopPropagation();
        }
      }
    >
      {getCircle(radii[1])}
      { task.status == 'complete' ?  getFill(radii[1]) : undefined }
    </svg>
  )
}

export function ListView({tasks, selectTask, onCommit, hoveredTaskID} : 
  { tasks : TaskMap, 
    selectTask: (t:string) => void,
    onCommit: (c: CommitEvent) => void
    hoveredTaskID: string;
   }
) {

  useEffect(() => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({behavior:'smooth', block: 'center'});
  }, [hoveredTaskID]);

  //const itemsRef = useRef({})
  const highlightRef = useRef(null);

  function toggleComplete(t : Task) {
    const e : CommitEvent = t.status == 'complete' 
      ? {id: t.id, type: 'uncomplete'} 
      : {id: t.id, type: 'complete'};


    return onCommit(e);
  }


  function ListItem({task} : {task: Task}) {
    return (
      <div className={'list-item ' + (task.id == hoveredTaskID ? 'highlight' : '') } 
        onClick={e => selectTask(task.id)}
        ref={task.id==hoveredTaskID ? highlightRef : null}>

        <CheckBox task={task} onClick={toggleComplete}></CheckBox>
        <span className='title'>{task.title}</span>
        <PriorityModal defaultValue={task.priority} 
          update={n => onCommit({id:task.id, type: 'setPriority', value: n})}/>
      </div>
    )
  }

  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeBlocked, setIncludeBlocked] = useState(false);
  const [includeExternal, setIncludeExternal] = useState(false);

  function sort(task1, task2) : number {
    return -(task2.priority - task1.priority);
  }

  function filter(t: Task) {
    if (!includeCompleted && t.status == 'complete') return false;
    if (!includeBlocked && t.isBlocked) return false;
    if (!includeExternal && t.isExternal) return false;
    return true;
  }


  return (
    <div id='list-view'>
      <div className='buttonbar'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'><FilterIcon /> Filters</Button>
          </DropdownMenuTrigger>
          <DropdownMenuGroup>
            <DropdownMenuContent>
            <DropdownMenuLabel>Include:</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={includeBlocked} 
                onCheckedChange={setIncludeBlocked}>
                  <CircleIcon fill={COLORS.node.fillBlocked}/>
                Blocked
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={includeCompleted} 
                onCheckedChange={setIncludeCompleted}>
                  <CircleIcon fill={COLORS.node.fillComplete}/>
                Complete
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={includeExternal} 
                onCheckedChange={setIncludeExternal}>
                  <SquareIcon />External
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenuGroup>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'><ArrowUpDownIcon />Sort</Button>
          </DropdownMenuTrigger>
          <DropdownMenuRadioGroup>
            <DropdownMenuContent>
              <DropdownMenuRadioItem
                value={'checked'}>
                  <BsExclamation />
                  Priority
              </DropdownMenuRadioItem>
            </DropdownMenuContent>
          </DropdownMenuRadioGroup>
        </DropdownMenu>
      </div>
      <div id='list-items'>
        {
          Object.values(tasks)
            .filter(filter)
            .sort(sort)
            .map(t => <ListItem key={t.id} task={t} />)
        }
      </div>

    </div>
  )
}
