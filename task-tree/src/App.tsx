/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useEffect, useMemo } from 'react'
import './App.css'
import * as d3 from 'd3'
import { saveTasks, getTasks, calculate, processIntent, type Task, type CommitEvent, generateID } from './Tasks.ts';
import { Inspect, Tooltip } from './Inspect.tsx';

import {testDict} from './data.js';

// Fence locations
const COMPLETED_TASK_SETPOINT = 150;
const GRAVITY_SETPOINT = 200;
const BLOCKED_SETPOINT = 400;

// Fence parameters
const fFENCE = -16;
const FENCE_DECAY = -30;

// Force strength
//const FORCE_SCALAR = .05;
const fGRAVITY = .0040;
const fCHARGE = -1.999;
const fLINK = .1005;
const fCENTER = 0.0020;
//const COMPLETED_TASK = 15 * FORCE_SCALAR;

const COLORS = {
  node: {
    stroke: '#000',
    strokeWidth: 2,
    strokeSelected: '#999',
    fillComplete: '#9f9',
    fillBlocked: '#777',
    fillAvailable: '#fff',
    fillGhost: '#fff',
    opacityGhost: 0.8,
  },

  border: {
    complete: '#afa',
    blocked: '#eee'
  },

  edge: {
    strokeWidth: 2,
    start: '#9f9',
    end: '#000',
    startGhost: '#9f9',
    endGhost: '#000',
    opacityGhost: 0.99,
  },

  region: {
    complete: '#9f9',
    available: '#999',
    blocked: '#666',
  }
}

const SIM = {
  alphaTarget: 0.3,
  alphaDecay: 0.01
}

type SpawnHint = {
  id: string,
  x: number,
  y: number
}

const linkGradient = [{offset: "10%", color: COLORS.edge.start}, {offset: "90%", color: COLORS.edge.end}];
type Node = d3.SimulationNodeDatum & {
  id: string,
  group?: number,
  task: Task,
  hovered: boolean
}

type Link = { source: string, target: string, id: string };
export type TaskMap = Record<string, Task>;

/** Get the hex color of a node based on its properties */
function nodeColor( node : Node ) : string {
  //if (node.task.isExternal) { return '#39f'}
  if (node.task.status == 'complete') { return COLORS.node.fillComplete }
  if (node.task.isBlocked) { return COLORS.node.fillBlocked }
  return COLORS.node.fillAvailable;
}

/** Get the radius of a node based on its properties */
function nodeSize(node: Node | null) : number {
  if (!node) return 60;
  switch (node.task.priority) {
    case 1: return 60;
    case 2: return 45;
    case 3: return 35;
    case 4: return 30;
    case 5: return 30;
    default: return 10;
  }
}

/** Get the appropriate center of gravity for a given node */
function nodeGravitySetpoint(node: Node) : number {
  if (node.task.status == 'complete') { return COMPLETED_TASK_SETPOINT; }
  if (node.task.isBlocked) { return 500; }
  return GRAVITY_SETPOINT;
}

/** Constrain a number between min and max */
function constrain (n : number, min : number, max : number) : number {
  return Math.min(Math.max(n,min), max)
}

/** Exert a custom y-force with exponential magnitude */
function forceY(y0 : number, strength : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
  let nodes : Node[];
  const dir = direction ? direction : 1;
  const fIB = strength;
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


function refactorData(tasks: TaskMap, 
                      prev: {nodes: Map<string,Node>, links: Link[]} 
                          = {nodes: new Map<string, Node>(), links: []}) 
                      : { nodes : Map<string,Node>, links: Link[]} {

  const newNodes : Map<string, Node> = new Map()
  let newLinks = prev.links;

  for (const [id, task] of Object.entries(tasks)) {
    const node = prev.nodes.get(id) ?? {
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
  { tasks: TaskMap, 
    onCommit: (events: CommitEvent[]) => void, 
    selectTask: (id: string) => void, 
    hoverTask: (id: string) => void } ) {

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<Node, undefined> | null>(null);
  const simDataRef = useRef<{nodes: Node[], links: Link[]}>({nodes: [], links: []});
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])
  const containerRef = useRef(null);
  const [spawnHint, setSpawnHint] = useState<SpawnHint | null>(null);


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
      .alphaTarget(SIM.alphaTarget)
      .alphaDecay(SIM.alphaDecay)
      .force("charge", d3.forceManyBody().strength(fCHARGE))
      .force("collide", d3.forceCollide(d => 30)) // TODO: add priority
      //.force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

      .force("center", d3.forceX(0).strength(fCENTER))
      .force("gravity", d3.forceY(nodeGravitySetpoint).strength(fGRAVITY))

      .force('centerUpperBound', forceY(COMPLETED_TASK_SETPOINT, -10, d => d.task.status != 'complete', -1))
      .force('centerLowerBound', forceY(BLOCKED_SETPOINT, -10, d => !d.task.isBlocked))
      .force("complete", forceY(COMPLETED_TASK_SETPOINT, fFENCE, d => d.task.status=='complete'))
      .force("blocked", forceY(BLOCKED_SETPOINT, -1, d => d.task.isBlocked, -1))

    simRef.current = sim;

    const link = svg.append('g')
      .attr('id', 'link')
      .attr('stroke-width','2');

    const ghostLink = svg.append('g').attr('id', 'ghost-link')

    const node = svg.append('g')
      .attr('id', 'node')
      .attr('stroke-width', COLORS.node.strokeWidth)
      .attr('stroke', COLORS.node.stroke);

    const ghostNode = svg.append('g')
      .attr('id', 'ghost-node')
      .attr('stroke-width', COLORS.node.strokeWidth)
      .attr('stroke', COLORS.node.stroke)
      .attr('fill', COLORS.node.fillGhost)
      .attr('opacity', COLORS.node.opacityGhost);



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
    
    console.log("Building simData from", solvedTasks);
    //simDataRef.current = buildSimData(tasks, simDataRef.current)
    simDataRef.current = buildSimData(solvedTasks, simDataRef.current)
    const nodes = simDataRef.current.nodes;
    const links = simDataRef.current.links;

    simulation.nodes(nodes);
    simulation.force("link", d3.forceLink(links).id((d: Node) => d.id).strength(fLINK))

    const node = svg.select('g#node')
      .selectAll('rect')
      .data(nodes, (d: Node) => d.task.id)
      .join(
        enter => {

          console.log("Enter has", enter.size(), "new objects");
          return enter.append('rect')
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
            .attr('fill', nodeColor)
            .attr('id', d => d.task.id)
            ;

        },
        update => {
          update
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
          update.transition().duration(200)
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
            .attr('fill', nodeColor);
          return update
        }
        ,
        exit => { 
          console.log('Exit has', exit.size(), 'items:', exit)
          exit.remove(); 
        }
      );

    if (spawnHint) {
      node.each((d,i) => {
        if (d.id == spawnHint.id) {
          d.x = spawnHint.x;
          d.y = spawnHint.y;
          d.vx = 0;
          d.vy = 0;
        }

      })


      setSpawnHint(null)
    }
    
    function attachTooltipToMouse(event, d) {
      tooltip
        .style('top', (event.y+10)+'px')
        .style('left', (event.x+10)+'px');
    }

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
    
    node.on('click', selectNode);
    node.on('mouseover', hoverNode);
    node.on('mousemove', attachTooltipToMouse)
    node.on('mouseout', () => tooltip.style('visibility', 'hidden'))

    //node.append('title').text(d => d.task.title);
    // Add a drag behavior.
    function applyDragListener() {
      node.call(d3.drag()
            .on("start.d", dragstarted)
            .on("drag.d", dragged)
            .on("end.d", dragended));
    };
    applyDragListener();

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

    function freezeSim() {
      nodes.forEach(n => {
        n.fx = n.x;
        n.fy = n.y;
        n.vx = 0;
        n.vy = 0;
      })
      simulation.alpha(0).alphaTarget(0);
    }
    function resumeSim() {
      //node.attr('vx',0).attr('vy',0);
      nodes.forEach(n => {
        n.fx = null;
        n.fy = null;
        n.vx = 0;
        n.vy = 0;
      })
      simulation.alpha(.99).alphaTarget(SIM.alphaTarget).restart();

    }


    // Set the position attributes of links and nodes each time the simulation ticks.
    // Reheat the simulation when drag starts, and fix the subject position.
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3);//.restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;

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

      if (event.y > BLOCKED_SETPOINT) {
        blockedTaskRegion.attr('opacity', .2)
      } else {
        blockedTaskRegion.attr('opacity', 0)
      }

    }

    /**
     * Spawn a temporary node in a new layer as a touch target
     * @param x X position to spawn ghost node at
     * @param y Y position to spawn ghost node at
     * @param dependsOn 
     * @param children 
     * @returns d3 selection of the temporary node
     */
    function tempNode(x,y, children: string[] = []) {

      const r = nodeSize(null);
      console.log('node selection:', node.size());

      const n = svg.select('g#ghost-node').append('rect')
          .attr('width', r)
          .attr('height', r) 
          .attr('rx', r) 
          .attr('ry', r)
          .attr('x',x - r/2)
          .attr('y',y - r/2)
          .attr('opacity', COLORS.node.opacityGhost)
      
      console.debug(n)
      return n
    }

    function tempLine(x1,y1,x2,y2) {
      svg.select('g#ghost-link').append('line')
        .attr('stroke', COLORS.edge.start)
        .attr('stroke-width', COLORS.edge.strokeWidth)
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2+nodeSize(null)/2)
    }


    // Restore the target alpha so the simulation cools after dragging ends.
    // Unfix the subject position now that it’s no longer being dragged.
    function dragended(event,d) {

      console.debug('Drag ended on node', d)

      //const targetNode = event.subject;
      const targetNode = d;

      if (!event.active) simulation.alphaTarget(SIM.alphaTarget);

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
          onCommit([{id: targetNode.id, type: 'complete'}])
        }

      }
      if (targetNode.y > COMPLETED_TASK_SETPOINT) {
        //targetNode.status = 'not started';
        //tasks[targetNode.id].status = 'not started';

        if (targetNode.task.status == 'complete') {
          onCommit([{id: targetNode.id, type: 'uncomplete'}])
        }

      }

      function cleanup() {
        svg.select('g#ghost-link').selectAll('*').remove();
        svg.select('g#ghost-node').selectAll('*').remove();
        node.on('click.block', null);
        viz_regions.on('click.resume', null);
        resumeSim();
        applyDragListener();

      }

      if (targetNode.y > BLOCKED_SETPOINT) {
        // Now we need to get a node id to choose as blocker
        
        // Select node
        selectNode(event, d);
        // Add "ghost node"

        // Freeze simulation
        freezeSim();
        // Disable dragging
        node.on('.drag',null);

        node.on('click.block', (event, d) => {
          console.debug("node a", targetNode)
          console.debug("node b", d)
          onCommit([{id: targetNode.id, type: 'block', blockerId: d.id}])
          cleanup();
          //selectNode(event, d.id);
        })

        const [ghostX, ghostY] = [d.x, d.y-100]
        const ghostLine = tempLine(d.x,d.y,ghostX,ghostY)
        const ghostNode = tempNode(ghostX, ghostY)
        ghostNode.on('click', () => { 
          const newID = generateID();
          onCommit([
            { id: newID, type: 'add' }, 
            { id: targetNode.id, type: 'block', blockerId: newID }
          ]);

          setSpawnHint({id: newID, x:d.x, y:d.y - 100});
          //selectNode(event, d.id);

          cleanup();
        })
        
        viz_regions.on('click.resume', (event, d) => {
          // kindly cancel
          console.debug('Resuming without changes');
          cleanup();
        });


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

/*
 
  █████╗ ██████╗ ██████╗ 
 ██╔══██╗██╔══██╗██╔══██╗
 ███████║██████╔╝██████╔╝
 ██╔══██║██╔═══╝ ██╔═══╝ 
 ██║  ██║██║     ██║     
 ╚═╝  ╚═╝╚═╝     ╚═╝     
                         
 
*/

export default function App() {

  const [tasks, setTasks] = useState<TaskMap>(testDict)
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])

  const [selectedTaskID, setSelectedTaskID] = useState<string>();
  const [hoveredTaskID, setHoveredTaskID] = useState<string>();

  const save = saveTasks(solvedTasks);
  const load = () => getTasks().then(data => setTasks(data.snapshot))

  
  //console.log("Initial task import:", tasks)

  function handleCommit(event: CommitEvent) {
    //setTasks(prev =>)
    console.log("Commit event:", event);

    setTasks(processIntent(event, solvedTasks))

    //console.debug("Updated tasks: ", tasks);
  }

  function handleCommits(events : CommitEvent[]) {

    setTasks(prev => {
      let updated = solvedTasks;
      for (const e of events) {
        updated = processIntent(e, updated);
      }
      return updated;
    })
  }

  return (
    <>
      <Sim tasks={solvedTasks} onCommit={handleCommits} selectTask={setSelectedTaskID} hoverTask={setHoveredTaskID}/>
      <Inspect tasks={solvedTasks} taskID={selectedTaskID} selectTask={setSelectedTaskID} onCommit={handleCommit}/>
      <Tooltip tasks={tasks} taskID={hoveredTaskID}/>
      <button onClick={save}>Save tasks to server</button>
      <button onClick={load}>Load tasks from server</button>
    </>
  )
}

window.d3 = d3;

//export default App
