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
  status: string,
  isBlocked: boolean,
  isExternal: boolean
}

type Node = d3.SimulationNodeDatum & {
  id: string,
  group?: number,
  task: Task,
  hovered: boolean
}

/* Import data from an existing object */
function importData(tasks: Record<string, Task>) : Node[] {
  tasks = calculate(tasks);
  const nodes : Node[] = Object.values(tasks).map( t => {
    return {
      id: t.id,
      status: t.status,
      priority: t.priority,
      //isBlocked: true,
      //blocked: true,
      hovered: false,
      task: t
    }
  });

  return nodes;
}

function exportData(nodes : Node[]) : Record<string, Task> {
  const tasks : Record<string, Task> = {};
  nodes.forEach(d => tasks[d.id] = d.task);
  return tasks
}

function calculate(tasks : Record<string, Task>) {
  Object.values(tasks).forEach( t => {
    t.isBlocked = false;

    for (const id of t.dependsOn) {
      if (tasks[id].status != 'complete') { t.isBlocked = true; break }
    }

  })

  return tasks;
}

function recalculate(nodes : Node[]) : Node[] {
  // export nodes to data structure
  let tasks = exportData(nodes);

  let new_tasks = calculate(tasks);

  Object.keys(new_tasks).forEach(k => {
    if (new_tasks[k] != tasks[k]) {

    }
  })

  //tasks = calculate(tasks);

  return importData(tasks);

}

function buildSimData(tasks: Record<string, Task>) {
  const nodes = recalculate(importData(tasks))
  const links = Object.values(tasks).flatMap( t => t.dependsOn.map(c => ({source: c, target: t.id, id: `${c}-${t.id}`}) ))

  //console.log(links)

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

// Fence locations
const COMPLETED_TASK_SETPOINT = 150;
const GRAVITY_SETPOINT = 200;
const BLOCKED_SETPOINT = 250;

// Fence parameters
const FENCE_FORCE = -16;
const FENCE_DECAY = -30;

// Force strength
//const FORCE_SCALAR = .05;
const fGRAVITY = .0040;
const fCHARGE = -1.999;
const fLINK = .1505;
const fCENTER = 0.0010;
//const COMPLETED_TASK = 15 * FORCE_SCALAR;

const RAD_SCALAR = 8;

const BLOCKER_SIZE = 25;

const linkGradient = [{offset: "10%", color: '#9f9'}, {offset: "90%", color: "#000"}];

function colorNode( node ) {
  //console.log(node)
  //if (node.task.isExternal) { return '#39f'}
  if (node.status == 'complete') { return '#9f9' }
  if (node.task.isBlocked) { return '#999' }
  return '#fff';
}

function constrain (n : number, min : number, max : number) : number {
  return Math.min(Math.max(n,min), max)
}

function forceY(y0 : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
  let nodes : Node[];
  let dir = direction ? direction : 1;
  let fIB = FENCE_FORCE;
  const decay = FENCE_DECAY;
  function force(alpha : number) {
    for (const node of nodes) {
      if (!nodeFilter(node)) continue;

      const dy = (node.y - y0) * dir; // Positive when below line
      let a = fIB * Math.exp(-dy / decay) * alpha * dir;
      node.vy += constrain(a, -10, 10)
    }
  }

  force.initialize = n => {nodes = n}

  return force;
}

function Sim({ tasks } : { tasks: Record<string, Task> }) {

  const svgRef = useRef<SVGSVGElement | null>(null);

  let width = 500;
  let height = 400;

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    svg
      .attr('height', height)
      .attr('width', width)
      .attr('viewBox', [-width/2, 0, width, height])
      .attr('style', 'display: block; background-color: #eee;')
    
    width = +svg.attr('width');
    height = +svg.attr('height');

    const viz_regions = svg.append('g');
    const viz_lines = svg.append('g');
    const defs = svg.append('defs');
    let tooltip = d3.select('div#tooltip')
    
    let { nodes, links } = buildSimData(tasks);

    const simulation = d3.forceSimulation<Node>(nodes)
      .alphaTarget(.1)
      .alphaDecay(.01)
      .force("charge", d3.forceManyBody().strength(fCHARGE))
      .force("collide", d3.forceCollide(d => RAD_SCALAR*d.task.priority))
      .force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

      .force("center", d3.forceX(0).strength(fCENTER))
      .force("gravity", d3.forceY(GRAVITY_SETPOINT).strength(fGRAVITY))

      .force('centerUpperBound', forceY(COMPLETED_TASK_SETPOINT, d => d.status != 'complete', -1))
      .force('centerLowerBound', forceY(BLOCKED_SETPOINT, d => !d.task.isBlocked))
      .force("complete", forceY(COMPLETED_TASK_SETPOINT, d => d.status=='complete'))
      .force("blocked", forceY(BLOCKED_SETPOINT, d => d.task.isBlocked, -1))

    
    const link = svg.append('g')
      //.attr('stroke', '#333')
      .attr('stroke-width', '2')
      .selectAll('line')
      .data(links, d => d.id)
      .join('line')
      .attr('stroke', d=>`url(#grad-${d.id})`)

    viz_lines.append('line')
      .attr('stroke', '#292')
      .attr('stroke-width', '2')
      .attr('x1', -width/2)
      .attr('x2',  width/2)
      .attr('y1', COMPLETED_TASK_SETPOINT)
      .attr('y2',  COMPLETED_TASK_SETPOINT)
    
    viz_lines.append('line')
      .attr('stroke', '#555')
      .attr('stroke-width', '2')
      .attr('x1', -width/2)
      .attr('x2',  width/2)
      .attr('y1', BLOCKED_SETPOINT)
      .attr('y2',  BLOCKED_SETPOINT)
      
    const completedTaskRegion = viz_regions.append('rect')
      .attr('x', -width/2)
      .attr('width', width)
      .attr('y', 0)
      .attr('height', COMPLETED_TASK_SETPOINT)
      .attr('fill', '#292')
      .attr('opacity', 0)

    const mainTaskRegion = viz_regions.append('rect')
      .attr('x', -width/2)
      .attr('width', width)
      .attr('y', COMPLETED_TASK_SETPOINT)
      .attr('height', BLOCKED_SETPOINT - COMPLETED_TASK_SETPOINT)
      .attr('fill', '#fff')
      .attr('opacity', 0)
    
    const gradients = defs.selectAll('linearGradient')
      .data(links, d => d.id)
      .join('linearGradient')
        .attr('id', d => `grad-${d.id}`)
        .attr('gradientUnits', 'userSpaceOnUse')
    
    gradients
      .selectAll('stop')
      .data(linkGradient)
      .join('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color)
    
    const node = svg.append('g')
      .attr('stroke','#555')
      .attr('stroke-width', 2)
    .selectAll('g')
    .data(nodes)
    //.join('g').append('rect')
    .join('g').append('rect')
      .attr('r', d => RAD_SCALAR*d.priority)
      .attr('fill', colorNode)
      .attr('width', BLOCKER_SIZE)
      .attr('height', BLOCKER_SIZE)
      .attr('rx', d => d.task.isExternal ? 0 : BLOCKER_SIZE)
      .attr('ry', d => d.task.isExternal ? 0 : BLOCKER_SIZE)
      //.on('mouseover', tooltipUpdate)
      //.on("mousemove", (event, d) => tooltip.style("top", (event.offsetY+60)+"px").style("left",(event.x+10)+"px"))
      //.on('mouseout', () => tooltip.style('visibility', 'hidden'))
      .on('click', selectNode)

    
    nodes.forEach(d => {d.x = 0; d.y = 200; })
    
    node.append('title').text(d => d.title);
    // Add a drag behavior.
    node.call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

    function selectNode(event, d) {
      //alert('Selected node');
      clearSelection(event, d);
      tooltipUpdate(event, d);

      let targetNode = event.target;

      d3.select(this).attr('stroke', '#000')
    }

    function clearSelection(event, d) {
      node.attr('stroke', null)
    }
    

    
    simulation.on('tick', () => {
      node
        .attr('x', d => constrain(d.x, -width/2, width/2) - BLOCKER_SIZE / 2)
        .attr('y', d => constrain(d.y, 0, height) - BLOCKER_SIZE/2)
        .attr('fill', colorNode);

      link
        .attr('x1', d => d.source.x)
        .attr('x2', d => d.target.x)
        .attr('y1', d => d.source.y)
        .attr('y2', d => d.target.y)
      
      gradients
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
    });


    function tooltipUpdate(event, d) {
      let targetNode = event.target;
      //console.log(targetNode)
      //console.log(d)

      d.hovered = true;
      tooltip.style('visibility', 'visible')

      tooltip.select('#title').text(d.task.title)
      tooltip.select('#status').text(d.task.status)
      tooltip.select('#description').text(d.task.description)

      tooltip.style('left', event.x)
      tooltip.style('top', event.x)


    }

    
    // Set the position attributes of links and nodes each time the simulation ticks.
    // Reheat the simulation when drag starts, and fix the subject position.
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    // Update the subject (dragged node) position during drag.
    function dragged(event) {
      let targetNode = event.subject;

      event.subject.fx = event.x;
      event.subject.fy = event.y;

      if (targetNode.task.status != 'complete') {

        if (event.y < COMPLETED_TASK_SETPOINT) {
          completedTaskRegion.attr('opacity', .2)

        } else {
          completedTaskRegion.attr('opacity', 0)
        }
      }

      if (targetNode.task.status == 'complete') {
        if (event.y > COMPLETED_TASK_SETPOINT && event.y < BLOCKED_SETPOINT) {
          mainTaskRegion.attr('opacity', .99)

        } else {
          mainTaskRegion.attr('opacity', 0)
        }

      }

    }

    // Restore the target alpha so the simulation cools after dragging ends.
    // Unfix the subject position now that it’s no longer being dragged.
    function dragended(event) {

      let targetNode = event.subject;

      if (!event.active) simulation.alphaTarget(0.1);


      if (!targetNode.task.isExternal) {
        event.subject.fx = null;
        event.subject.fy = null;
      }

      if (targetNode.y < COMPLETED_TASK_SETPOINT) {
        targetNode.status = 'complete';
        tasks[targetNode.id].status = 'complete';

      }
      if (targetNode.y > COMPLETED_TASK_SETPOINT) {
        targetNode.status = 'not started';
        tasks[targetNode.id].status = 'not started';

      }

      completedTaskRegion.attr('opacity', 0)
      mainTaskRegion.attr('opacity', 0)
      nodes = recalculate(nodes);

    }

      

  });


  return (
    <div style={{border:'0px dotted blue'}}>
    <svg ref={svgRef}><g></g></svg>
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
      <div>
        <Sim tasks={data} />
        <div id='tooltip'>
          <h2 id='title'></h2>
          <h4 id='status'></h4>
          <p id='description'></p>
        </div>
      </div>

    </>
  )
}

      //<TaskBuilder callback={console.log}/>
export default App
