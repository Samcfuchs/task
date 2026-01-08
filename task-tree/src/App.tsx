/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useEffect, useMemo } from 'react'
import './App.css'
import * as d3 from 'd3'
import {testDict} from './data.js';
import {useWindowSize} from '@uidotdev/usehooks';
import Inspect from './Inspect.tsx';

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
const fCENTER = 0.0020;
//const COMPLETED_TASK = 15 * FORCE_SCALAR;

const BLOCKER_SIZE = 25;

const SERVER_PATH = "http://localhost:8000"

const COLORS = {
  node: {
    stroke: '#000',
    strokeSelected: '#999',
    fillComplete: '#9f9',
    fillBlocked: '#ccc',
    fillAvailable: '#fff',
  },

  border: {
    complete: '#afa',
    blocked: '#eee'
  },

  edge: {
    start: '#9f9',
    end: '#000'
  },

  region: {
    complete: '#9f9',
    available: '#999',
    blocked: '#666',
  }
}

const linkGradient = [{offset: "10%", color: COLORS.edge.start}, {offset: "90%", color: COLORS.edge.end}];

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

type Node = d3.SimulationNodeDatum & {
  id: string,
  group?: number,
  task: Task,
  hovered: boolean
}

type Link = { source: string, target: string, id: string };
export type TaskMap = Record<string, Task>;

export type CommitEvent =
| { type: 'complete'; id: string }
| { type: 'block'; id: string, blockerId: string }
| { type: 'uncomplete'; id: string }
| { id: string; type: 'update'; field: string; value: any }
| { id: string; type: 'setIsExternal', value: boolean }
| { id: string; type: 'setPriority', value: number }
| { id: string; type: 'delete' }

/* Get the hex color of a node based on its properties */
function nodeColor( node : Node ) : string {
  //console.log(node)
  //if (node.task.isExternal) { return '#39f'}
  if (node.task.status == 'complete') { return COLORS.node.fillComplete }
  if (node.task.isBlocked) { return COLORS.node.fillBlocked }
  return COLORS.node.fillAvailable;
}

const RAD_SCALAR = 1;
function nodeSize(node: Node) : number {
  const scale = RAD_SCALAR;
  switch (node.task.priority) {
    case 1: return 60;
    case 2: return 45;
    case 3: return 35;
    case 4: return 30;
    case 5: return 30;
    default: return 10;
  }
}

function nodeGravitySetpoint(node: Node) : number {
  if (node.task.status == 'complete') { return COMPLETED_TASK_SETPOINT; }
  if (node.task.isBlocked) { return 500; }
  return GRAVITY_SETPOINT;
}

/* Constrain a number between min and max */
function constrain (n : number, min : number, max : number) : number {
  return Math.min(Math.max(n,min), max)
}

/** Exert a custom y-force with exponential magnitude */
function forceY(y0 : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
  let nodes : Node[];
  const dir = direction ? direction : 1;
  const fIB = FENCE_FORCE;
  const decay = FENCE_DECAY;
  function force(alpha : number) {
    for (const node of nodes) {
      if (!nodeFilter(node)) continue;
      if (!node.y) continue;

      const dy = (node.y - y0) * dir; // Positive when below line
      const a = fIB * Math.exp(-dy / decay) * alpha * dir;
      node.vy = constrain(a, -10, 10) + (node.vy ?? 0)
    }
  }

  force.initialize = (n : Node[]) => {nodes = n};

  return force;
}

function calculate(tasks : Record<string, Task>) : Record<string, Task> {
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

function refactorData(tasks: TaskMap, 
                      prev: {nodes: Map<string,Node>, links: Link[]} = {nodes: new Map<string, Node>(), links: []}) 
                      : { nodes : Map<string,Node>, links: Link[]} {

  const newNodes = prev.nodes;
  let newLinks = prev.links;

  for (const [id, task] of Object.entries(tasks)) {
    const node = newNodes.get(id) ?? {
      id: task.id,
      task: task,
      hovered: false,
      selected: false,
      x: 0,
      y: 200,
      vx: 0,
      vy: 0
    }

    node.task = task;

    newNodes.set(id, node);
  }

  newLinks = Array.from(newNodes.values()).flatMap( t => (t.task.dependsOn ?? []).map(c => ({source: c, target: t.task.id, id: `${c}-${t.task.id}`}) ))

  return { nodes: newNodes, links: newLinks }
  

}

function buildSimData(tasks: TaskMap, prev: {nodes: Node[], links: Link[]} = {nodes: [], links: []}) 
                      : { nodes : Node[], links: Link[]} {
  //const nodes = importData(tasks)
  const nodeMap = new Map<string, Node>(prev.nodes.map(node => [node.id, node]))
  const links = prev.links;


  const d = refactorData(tasks, {nodes: nodeMap, links: links})

  return { nodes: Array.from(d.nodes.values()), links: d.links }

}

/*
 
 ███████╗██╗███╗   ███╗     ██████╗ ██████╗ ███╗   ███╗██████╗  ██████╗ ███╗   ██╗███████╗███╗   ██╗████████╗
 ██╔════╝██║████╗ ████║    ██╔════╝██╔═══██╗████╗ ████║██╔══██╗██╔═══██╗████╗  ██║██╔════╝████╗  ██║╚══██╔══╝
 ███████╗██║██╔████╔██║    ██║     ██║   ██║██╔████╔██║██████╔╝██║   ██║██╔██╗ ██║█████╗  ██╔██╗ ██║   ██║   
 ╚════██║██║██║╚██╔╝██║    ██║     ██║   ██║██║╚██╔╝██║██╔═══╝ ██║   ██║██║╚██╗██║██╔══╝  ██║╚██╗██║   ██║   
 ███████║██║██║ ╚═╝ ██║    ╚██████╗╚██████╔╝██║ ╚═╝ ██║██║     ╚██████╔╝██║ ╚████║███████╗██║ ╚████║   ██║   
 ╚══════╝╚═╝╚═╝     ╚═╝     ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝      ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═══╝   ╚═╝   
                                                                                                             
 
*/

function Sim({ tasks, onCommit, selectTask, hoverTask } : 
  { tasks: TaskMap, onCommit: (event: CommitEvent) => void, selectTask: (id: string) => void, hoverTask: (id: string) => void}) {

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<Node, undefined> | null>(null);
  const simDataRef = useRef<{nodes: Node[], links: Link[]}>({nodes: [], links: []});
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])
  const containerRef = useRef(null);


  let height = 800;
  let width = 400;

  const container = d3.select(containerRef.current)
  //console.debug('width', parseInt(container.style('width')));

  //let width = parseInt(container.style('width'));

/*
 
 ██╗███╗   ██╗██╗████████╗██╗ █████╗ ██╗         ███████╗███████╗███████╗███████╗ ██████╗████████╗
 ██║████╗  ██║██║╚══██╔══╝██║██╔══██╗██║         ██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝╚══██╔══╝
 ██║██╔██╗ ██║██║   ██║   ██║███████║██║         █████╗  █████╗  █████╗  █████╗  ██║        ██║   
 ██║██║╚██╗██║██║   ██║   ██║██╔══██║██║         ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║        ██║   
 ██║██║ ╚████║██║   ██║   ██║██║  ██║███████╗    ███████╗██║     ██║     ███████╗╚██████╗   ██║   
 ╚═╝╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝╚═╝  ╚═╝╚══════╝    ╚══════╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝   ╚═╝   
                                                                                                  
 
*/
  useEffect(() => { // Initial effect

    console.log("Initial effect");

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    //const container = d3.select(svg.node().parentNode);
    //const targetWidth = parseInt(container.style("width"));

    width = parseInt(svg.style('width'))
    height = parseInt(svg.style('height'))

    console.log(width, height);

    svg
      .attr('height', height)
      .attr('width', width)

      .attr('viewBox', [-width/2, 0, width, height])

    const viz_regions = svg.append('g').attr('id', 'regions');
    const viz_lines = svg.append('g').attr('id', 'borders');
    const defs = svg.append('defs');

    function makeLine(y : number, color : string) {
      const l = viz_lines.append('line')
        .attr('stroke', color)
        .attr('stroke-width', '2')
        .attr('x1', -width/2)
        .attr('x2',  width/2)
        .attr('y1', y)
        .attr('y2',  y)
      return l;
    }

    makeLine(COMPLETED_TASK_SETPOINT, COLORS.border.complete);
    makeLine(BLOCKED_SETPOINT, COLORS.border.blocked);

    const sim = d3.forceSimulation<Node>()
      .alphaTarget(.1)
      .alphaDecay(.01)
      .force("charge", d3.forceManyBody().strength(fCHARGE))
      .force("collide", d3.forceCollide(d => 30)) // TODO: add priority
      //.force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

      .force("center", d3.forceX(0).strength(fCENTER))
      .force("gravity", d3.forceY(nodeGravitySetpoint).strength(fGRAVITY))

      .force('centerUpperBound', forceY(COMPLETED_TASK_SETPOINT, d => d.task.status != 'complete', -1))
      .force('centerLowerBound', forceY(BLOCKED_SETPOINT, d => !d.task.isBlocked))
      .force("complete", forceY(COMPLETED_TASK_SETPOINT, d => d.task.status=='complete'))
      .force("blocked", forceY(BLOCKED_SETPOINT, d => d.task.isBlocked, -1))

    simRef.current = sim;

    const link = svg.append('g')
      .attr('id', 'link')
      .attr('stroke-width','2');

    const node = svg.append('g')
      .attr('id', 'node')
      .attr('stroke-width','2')
      .attr('stroke', COLORS.node.stroke);


    function makeRegion(y : number, height : number, fill : string) {
      const region = viz_regions.append('rect')
        .attr('x', -width/2)
        .attr('width', width)
        .attr('y', y)
        .attr('height', height)
        .attr('fill', fill)
        .attr('opacity', 0)

      return region;
    }

    const completedTaskRegion = makeRegion(0, COMPLETED_TASK_SETPOINT, COLORS.region.complete).attr('id','complete');
    const mainTaskRegion = makeRegion(COMPLETED_TASK_SETPOINT, BLOCKED_SETPOINT - COMPLETED_TASK_SETPOINT, COLORS.region.available).attr('id', 'main');
    const blockedTaskRegion = makeRegion(BLOCKED_SETPOINT, height - BLOCKED_SETPOINT, COLORS.region.blocked).attr('id','blocked');

  }, [width, height]);

/*
 
    ██╗   ██╗██████╗ ██████╗  █████╗ ████████╗███████╗    ███████╗███████╗███████╗███████╗ ██████╗████████╗
    ██║   ██║██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝██╔════╝    ██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝╚══██╔══╝
    ██║   ██║██████╔╝██║  ██║███████║   ██║   █████╗      █████╗  █████╗  █████╗  █████╗  ██║        ██║   
    ██║   ██║██╔═══╝ ██║  ██║██╔══██║   ██║   ██╔══╝      ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║        ██║   
    ╚██████╔╝██║     ██████╔╝██║  ██║   ██║   ███████╗    ███████╗██║     ██║     ███████╗╚██████╗   ██║   
     ╚═════╝ ╚═╝     ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝    ╚══════╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝   ╚═╝   
                                                                                       
*/

  useEffect(() => { // Update effect

    console.log("Update effect", tasks);
    if (!svgRef.current) return;
    if (!simRef.current) return;

    const svg = d3.select(svgRef.current)

    width = +svg.attr('width');
    height = +svg.attr('height');

    const tooltip = d3.select('div#tooltip')
    const viz_regions = svg.select('g#regions');
    const defs = svg.select('defs');
    const simulation = simRef.current;
    
    //simDataRef.current = buildSimData(tasks, simDataRef.current)
    simDataRef.current = buildSimData(solvedTasks, simDataRef.current)
    const nodes = simDataRef.current.nodes;
    const links = simDataRef.current.links;

    simulation.nodes(nodes);
    simulation.force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

    const node = svg.select('g#node')
      .selectAll('rect')
      .data(nodes, d => d.task.id)
      .join(
        enter => {

          console.log("Enter has", enter.size(), "new objects");
          //if (enter.size()) simulation.nodes(nodes);
          return enter.append('rect')
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))

        },
        update => {
          update
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
          update.transition()
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
          return update
        }
        ,
        exit => { exit.remove(); }
      );
    
    node.on('click', selectNode);
    node.on('mouseover', hoverNode);
    node.on('mousemove', attachTooltipToMouse)
    node.on('mouseout', () => tooltip.style('visibility', 'hidden'))

    function attachTooltipToMouse(event, d) {
      tooltip
        .style('top', (event.y+10)+'px')
        .style('left', (event.x+10)+'px');
    }


    //.exit().remove();
        //.on('mouseover', tooltipUpdate)
        //.on("mousemove", (event, d) => tooltip.style("top", (event.offsetY+60)+"px").style("left",(event.x+10)+"px"))
        //.on('mouseout', () => tooltip.style('visibility', 'hidden'))
        //.on('click', selectNode);

    const link = svg.select('g#link')
      .selectAll('line')
      .data(links, d => d.id)
      .join('line')
      .attr('stroke', d=>`url(#grad-${d.id})`)

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
    
    //node.append('title').text(d => d.task.title);
    // Add a drag behavior.
    node.call(d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

    function selectNode(event, d) {
      //alert('Selected node');
      node.attr('stroke', null).classed('selected', false);
      d3.select(this)
        .attr('stroke', COLORS.node.strokeSelected)
        .classed('selected', true)
      selectTask(d.task.id)
    }

    function hoverNode(event, d) {
      tooltip.style('visibility','visible');
      hoverTask(d.task.id);
    }
    

    
    simulation.on('tick', () => {
      node
        .attr('x', d => constrain(d.x, -width/2, width/2) - nodeSize(d) / 2)
        .attr('y', d => constrain(d.y, 0, height) - nodeSize(d)/2)
        .attr('fill', nodeColor);

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


    // Set the position attributes of links and nodes each time the simulation ticks.
    // Reheat the simulation when drag starts, and fix the subject position.
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;

      selectNode(event, event.subject);
      tooltip.style('visibility','hidden');
    }

    const completedTaskRegion = viz_regions.select('#complete');
    const mainTaskRegion = viz_regions.select('#main');
    const blockedTaskRegion = viz_regions.select('#blocked');

    // Update the subject (dragged node) position during drag.
    function dragged(event) {
      const targetNode = event.subject;

      //constrain(d.x, -width/2, width/2)
      event.subject.fx = constrain(event.x, -width/2, width/2)
      event.subject.fy = constrain(event.y, 0, height);

      if (targetNode.task.status != 'complete') {

        if (event.y < COMPLETED_TASK_SETPOINT) {
          completedTaskRegion.attr('opacity', .2)

        } else {
          completedTaskRegion.attr('opacity', 0)
        }
      }

      if (targetNode.task.status == 'complete') {
        if (event.y > COMPLETED_TASK_SETPOINT && event.y < BLOCKED_SETPOINT) {
          mainTaskRegion.attr('opacity', .2)

        } else {
          mainTaskRegion.attr('opacity', 0)
        }

      }

      if (!targetNode.task.isBlocked) {
        if (event.y > BLOCKED_SETPOINT) {
          blockedTaskRegion.attr('opacity', .2)
        } else {
          blockedTaskRegion.attr('opacity', 0)
        }
      }

    }

    // Restore the target alpha so the simulation cools after dragging ends.
    // Unfix the subject position now that it’s no longer being dragged.
    function dragended(event) {

      const targetNode = event.subject;

      if (!event.active) simulation.alphaTarget(0.1);

      // Un-fix node position
      event.subject.fx = null;
      event.subject.fy = null;

      /*
      if (!targetNode.task.isExternal) {
        event.subject.fx = null;
        event.subject.fy = null;
      }
        */

      if (targetNode.y < COMPLETED_TASK_SETPOINT) {
        //targetNode.status = 'complete';
        //tasks[targetNode.id].status = 'complete';

        if (targetNode.task.status != 'complete') {
          onCommit({id: targetNode.id, type: 'complete'})
        }

      }
      if (targetNode.y > COMPLETED_TASK_SETPOINT) {
        //targetNode.status = 'not started';
        //tasks[targetNode.id].status = 'not started';

        if (targetNode.task.status == 'complete') {
          onCommit({id: targetNode.id, type: 'uncomplete'})
        }

      }



      completedTaskRegion.attr('opacity', 0)
      mainTaskRegion.attr('opacity', 0)
      blockedTaskRegion.attr('opacity', 0)
      //nodes = recalculate(nodes);

    }

      

  }, [tasks]);


  return (
    <div style={{border:'0px dotted blue'}} id='svg-container' ref={containerRef}>
    <svg ref={svgRef} width='100%' viewBox='0 0 {defaultWidth} {defaultHeight}'><g></g></svg>
    </div>
  )
}

function saveTasks(tasks: TaskMap) {
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

async function getTasks() : Promise<{snapshot : TaskMap}> {
  return fetch(SERVER_PATH + "/api/load", { 
    method: "GET",
    headers: {
      //"Content-Type": "application/json",
      "Access-Control-Allow-Origin": "true"
    }
  }).then(res => res.json())
}

function Tooltip({tasks, taskID} : {tasks: TaskMap, taskID: string | undefined}) {

  if (taskID == undefined) return (<div id='tooltip'></div>)
  if (!tasks[taskID]) return (<div id='tooltip'></div>)
    

  return (
    <div id='tooltip'>
      <h1>{tasks[taskID].title}</h1>
    </div>
  )
}

export default function App() {

  const [tasks, setTasks] = useState<TaskMap>(testDict)
  const [selectedTaskID, setSelectedTaskID] = useState<string>();
  const [hoveredTaskID, setHoveredTaskID] = useState<string>();
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])

  const save = saveTasks(solvedTasks);
  const load = () => getTasks()
    //.then(console.debug)
    .then(data => setTasks(data.snapshot))
    //.then(() => console.log("Data loaded"));

  
  //console.log("Initial task import:", tasks)

  function handleCommit(event: CommitEvent) {
    //setTasks(prev =>)
    console.log("Commit event:", event);

    setTasks(prev => {
      //prev = calculate(prev);
      prev = solvedTasks;
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
        case 'update': { // TODO implement
          const t = prev[event.id]
          return {...prev, [event.id]: {...t}}
        }
        case 'setIsExternal': {
          return {...prev, [event.id]: {...t, isExternal: event.value}}
        }
        case 'setPriority': {
          return {...prev, [event.id]: {...t, priority: event.value}}
        }
        default: return prev;
      }
    });

  }

  return (
    <>
      <Sim tasks={solvedTasks} onCommit={handleCommit} selectTask={setSelectedTaskID} hoverTask={setHoveredTaskID}/>
      <Inspect tasks={solvedTasks} taskID={selectedTaskID} onCommit={handleCommit}/>
      <Tooltip tasks={tasks} taskID={hoveredTaskID}/>
      <button onClick={save}>Save tasks to server</button>
      <button onClick={load}>Load tasks from server</button>
    </>
  )
}

      //<TaskBuilder callback={console.log}/>
//export default App
