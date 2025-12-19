import { useState, useRef, useEffect } from 'react'
import './App.css'
import * as d3 from 'd3'
import {loremIpsum} from 'lorem-ipsum'
import {testData, testDict} from './data.js';

type Task = {
  title:string,
  id: string,
  description:string,
  priority: number,
  dependsOn: string[],
  status: string
}

type Node = d3.SimulationNodeDatum & {
  id: string,
  group?: number
}

function buildSimData(tasks: { string:Task}) {
  const nodes : Node[] = Object.values(tasks).map( t => {

    let isBlocked = false;

    for (const id of t.dependsOn) {
      if (tasks[id].status != 'complete') { isBlocked = true; break }
    }

    return {
      id: t.id, 
      status: t.status,
      priority: t.priority,
      blocked: isBlocked
    } 
  })
  const links = Object.values(tasks).flatMap( t => t.dependsOn.map(c => ({source: c, target: t.id}) ))

  console.log(links)

  return { nodes, links }

}

function getRandomTask() {

  const n =  Math.floor((Math.random() * 255))


  const t : Task = {
    title: `task ${n}`,
    id: n.toString(16),
    description: loremIpsum(),
    priority: 0,
  }

  return t

}

const COMPLETED_TASK_SETPOINT = -100;
const GRAVITY_SETPOINT = 150;
const UNBLOCKED_SETPOINT = 0;


const FORCE_SCALAR = .05;
const GRAVITY = .4 * FORCE_SCALAR;
const CHARGE = -200 * FORCE_SCALAR;
const LINK = 3 * FORCE_SCALAR;
const COMPLETED_TASK = 15 * FORCE_SCALAR;

const RAD_SCALAR = 6;

function colorNode( node ) {
  if (node.status == 'complete') { return '#9f9' }
  if (node.blocked) { return '#999' }
  return '#fff';
}

function Sim({ tasks } : { tasks: { id : Task } }) {

  const svgRef = useRef<SVGSVGElement | null>(null);

  const width = 400;
  const height = 400;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width/2, -height/2, width, height])
      .attr('style', 'display: block; background-color: #eee;')
    
    //const nodes : Node[] = tasks.map( t => ({ id: t.id }) )
    //const links = tasks.flatMap( t => t.children.map(c => ({source: t.id, target:c}) ))

    const { nodes, links } = buildSimData(tasks);

    const simulation = d3.forceSimulation<Node>(nodes)
      //.alphaTarget(.1)
      .alphaDecay(.01)
      .force("charge", d3.forceManyBody().strength(CHARGE))
      .force("center", d3.forceCenter().strength(0))
      .force("link", d3.forceLink(links).id(d => d.id).strength(LINK))
      .force("collide", d3.forceCollide(d => RAD_SCALAR*d.priority))

      .force("gravity", d3.forceY(GRAVITY_SETPOINT).strength(GRAVITY))
      .force("liftCompleted", 
        d3.forceY(COMPLETED_TASK_SETPOINT)
        .strength(d => d.status == "complete" ? COMPLETED_TASK : 0))
      .force("liftAvailable", 
        d3.forceY(UNBLOCKED_SETPOINT)
        .strength(d => d.blocked ? 0 : COMPLETED_TASK))
    
    const lines = svg.append('g');
    const link = svg.append('g')
      .attr('stroke', '#333')
      .attr('stroke-width', '2')
    .selectAll('line')
    .data(links)
    .join('line')

    const node = svg.append('g')
      .attr('stroke','purple')
      .attr('stroke-width', 2)
    .selectAll('circle')
    .data(nodes)
    .join('circle')
      .attr('r', d => RAD_SCALAR*d.priority)
      .attr('fill', d => colorNode(d));
    
    lines.append('line')
        .attr('stroke', '#292')
        .attr('stroke-width', '2')
        .attr('x1', -width/2)
        .attr('x2',  width/2)
        .attr('y1', COMPLETED_TASK_SETPOINT)
        .attr('y2',  COMPLETED_TASK_SETPOINT)
    
    lines.append('line')
        .attr('stroke', '#555')
        .attr('stroke-width', '2')
        .attr('x1', -width/2)
        .attr('x2',  width/2)
        .attr('y1', GRAVITY_SETPOINT)
        .attr('y2',  GRAVITY_SETPOINT)

    
    node.append('title').text(d => d.title);

    simulation.on('tick', () => {
      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      link
        .attr('x1', d => d.source.x)
        .attr('x2', d => d.target.x)
        .attr('y1', d => d.source.y)
        .attr('y2', d => d.target.y)
    });
      

  });


  return (
    <div style={{border:'1px dotted blue'}}>
    <svg ref={svgRef} >
      <g fill='red'>
        {Object.values(tasks).map((d,i) => (<circle key={d.id} cx={d3.randomInt(100)()} cy={d3.randomInt(100)()} r={5}/>) ) }
      </g>
    </svg>
    </div>
  )
}

function TaskBuilder({ callback } : { callback: (task: Task) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) return;

    const t : Task = {
      title: title,
      description: description.trim(),
      priority: priority,
      id: crypto.randomUUID(),
      parents: [],
      children: []
    }

    callback(t);

    setTitle("");
    setDescription("")
  }

  return (
    <div>
      <h2>Add task!</h2>
      <form onSubmit={handleSubmit}>

        <label htmlFor="title">Title</label>
        <input type="text" name="title" id="title" 
          value={title} onChange={e => setTitle(e.target.value)} 
        />
        <br/>

        <label htmlFor="details">Details</label>
        <input type="text" name="details" id="details" 
          value={description} onChange={e => setDescription(e.target.value)}
        />
        <br/>

        <label htmlFor="priority">Priority</label>
        <input type="number" name="priority" id="priority" 
          value={priority} onChange={ e=>setPriority(Number(e.target.value)) } 
          step={1} min={0} max={5} 
        />
        <br/>

        <input type="submit" value="submit" />

      </form>
    </div>
  )
}

function App() {

  const [data, setData] = useState(() => testDict)

  function addTask(t : Task) {
    setData({...data, 'asdfasdf': t})
    console.log("Task added?");
  }


  console.log(data)



  return (
    <>
      <TaskBuilder callback={console.log}/>
      <div>
        <Sim tasks={data} />
      </div>
      <h1>Vite + React</h1>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>

      <div onClick={addTask}>Add a bubble</div>

    </>
  )
}

export default App
