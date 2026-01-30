/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import '@/styles/App.css';
import * as d3 from 'd3'
import { saveTasks, getTasks, calculate, processIntent, type Task, type CommitEvent } from './Tasks.ts';
import { Inspect, Tooltip, ListView} from './Inspect.tsx';
import { generateID } from './Domain.ts'

import { BsCheck, BsX } from "react-icons/bs";
import {testDict} from './data.js';
import { Button } from './components/ui/button.tsx';
import { CloudDownload, Tag, UserIcon, LogOutIcon, ChevronDown, Undo2, Redo2, Save, Filter } from 'lucide-react';
import { Toggle } from './components/ui/toggle.tsx';

import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, DropdownMenuGroup, 
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuLabel, 
  DropdownMenuSubContent,
  DropdownMenuSub,
  DropdownMenuSubTrigger
} from '@/components/ui/dropdown-menu.tsx';
import { supabase } from './lib/supabase/client.ts';

const [LABEL_OFFSET_X, LABEL_OFFSET_Y] = [20,-20]

// Fence parameters
const fFENCE = -16;
const FENCE_DECAY = -30;

// Force strength
//const FORCE_SCALAR = .05;
const fGRAVITY = .0140;
const fCHARGE = -10.999;
const fLINK = .0505;
const fCENTER = 0.0000;
const fWALL = 0.0026;
//const COMPLETED_TASK = 15 * FORCE_SCALAR;

// Fence locations
//TODO4: Adjust fence locations
const COMPLETED_TASK_SETPOINT = .35;
const GRAVITY_SETPOINT = 0;
const BLOCKED_SETPOINT = -.25;


const COLORS = {
  node: {
    stroke: '#000',
    strokeWidth: 2,
    strokeSelected: '#333',
    fillComplete: '#9f9',
    fillBlocked: '#999',
    fillAvailable: '#fff',
    fillGhost: '#fff',
    opacityGhost: 0.8,
  },

  border: {
    complete: '#599959',
    blocked: '#666'
  },

  edge: {
    strokeWidth: 3,
    start: '#9f9',
    end: '#000',
    startGhost: '#9f9',
    endGhost: '#000',
    opacityGhost: 0.99,
  },

  region: {
    complete: '#daffda',
    available: '#eee',
    blocked: '#ccc',
  },

  text: {
    fill: '#001'
  }
}

const SIM = {
  alphaTarget: 0,
  alphaDecay: 0.003,
  ambientWarm: 0.8
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
    case 1: return 50;
    case 2: return 35;
    case 3: return 25;
    case 4: return 20;
    case 5: return 20;
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
// TO/DO1: Write forceX as related to forceY
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

function forceX(x0 : number, strength : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
  let nodes : Node[];
  const dir = direction ? direction : 1;
  const fIB = strength;
  const decay = FENCE_DECAY;
  function force(alpha : number) {
    for (const node of nodes) {
      if (!nodeFilter(node)) continue;
      if (!node.x) continue;

      const dy = (node.x - x0) * dir; // Positive when below line
      const a = fIB * Math.exp(-dy / decay) * alpha * dir;
      node.vx = constrain(a, -10, 10) + (node.vx ?? 0)
    }
  }

  force.initialize = (n : Node[]) => {nodes = n};

  return force;
}

// TO/DO6: edit data refactor to spread nodes along y axis
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
      x: Math.random(),
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
export function Sim({ tasks, onCommit, selectTask, hoverTask, selectedTask, addDependencyTask, setAddDependencyTask, vizConfig } : 
  { tasks: TaskMap, 
    onCommit: (events: CommitEvent[]) => void, 
    selectTask: (id: string) => void, 
    hoverTask: (id: string) => void, 
    selectedTask: string,
    addDependencyTask: string,
    setAddDependencyTask: (id:string) => void,
    vizConfig: object
  } ) {

  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<d3.Simulation<Node, undefined> | null>(d3.forceSimulation());
  const simDataRef = useRef<{nodes: Node[], links: Link[]}>({nodes: [], links: []});
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])
  const containerRef = useRef(null);
  const [spawnHint, setSpawnHint] = useState<SpawnHint | null>(null);
  const nodeRef = useRef(null);
  //let currentClickIsDrag = false;
  const currentClickIsDrag = useRef(false);

  const layoutRef = useRef({blockedSetpoint:null, completedSetpoint:null})

  const dimsRef = useRef({width:null, height:null});
  const container = d3.select(containerRef.current)


  // TODO3: Fix height & width
  const HEIGHT = 800;
  const width = 500;

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const dims = entries[0].contentRect;
      dimsRef.current = {width:dims.width, height:dims.height};
      console.debug("Changing dims to", dimsRef.current);
      resizeEvent();
    })

    ro.observe(containerRef.current)
    return () => ro.disconnect();
  })


  //console.debug('width', parseInt(container.style('width')));

  //let width = parseInt(container.style('width'));
  function freezeSim() {
    console.debug("Sim freezing");
    simDataRef.current.nodes.forEach(n => {
      n.fx = n.x;
      n.fy = n.y;
      n.vx = 0;
      n.vy = 0;
    })
    simRef.current.alpha(0).alphaTarget(0);
  }

  function resumeSim() {
    console.debug("Sim resuming");
    simDataRef.current.nodes.forEach(n => {
      n.fx = null;
      n.fy = null;
      n.vx = 0;
      n.vy = 0;
    })
    simRef.current.alpha(.99).alphaTarget(SIM.alphaTarget).restart();
  }


  function tempNode(x,y, children: string[] = []) {

    const r = nodeSize(null);
    //console.log('node selection:', node.size());

    const n = d3.select(svgRef.current).select('g#ghost-node').append('rect')
        .attr('width', r)
        .attr('height', r) 
        .attr('rx', r) 
        .attr('ry', r)
        .attr('x',x - r/2)
        .attr('y',y - r/2)
        .attr('opacity', COLORS.node.opacityGhost)
        .raise();
    
    return n
  }

  function tempLine(x1,y1,x2,y2) {
    d3.select(svgRef.current).select('g#ghost-link').append('line')
      .attr('stroke', COLORS.edge.start)
      .attr('stroke-width', COLORS.edge.strokeWidth)
      .attr('x1', x1)
      .attr('y1', y1)
      .attr('x2', x2)
      .attr('y2', y2+nodeSize(null)/2)
      .raise();
  }

  function hoverNode(event, d) {
    d3.select("#tooltip").classed('hidden', false);
    hoverTask(d.task.id);
  }

  function cleanup() {
    d3.select(svgRef.current).select('g#ghost-link').selectAll('*').remove();
    d3.select(svgRef.current).select('g#ghost-node').selectAll('*').remove();
    d3.select(svgRef.current).select('g#node').selectAll('g').on('click.block', null);
    d3.select('g#regions').on('click.resume', null);
    resumeSim();
    applyDragListener();

  }

  function attachTooltipToMouse(event, d) {
    d3.select("#tooltip")
      .style('top', (event.y+10)+'px')
      .style('left', (event.x+10)+'px');
  }

  function buildForceSim() {

    const { width } = dimsRef.current;

    const sim = simRef.current
    .alphaTarget(SIM.alphaTarget)
    .alphaDecay(SIM.alphaDecay)
    .force("charge", d3.forceManyBody().strength(fCHARGE))
    .force("collide", d3.forceCollide(d => nodeSize(d) / 2))
    //.force("collide", d3.forceCollide(rCOLLISION)) // TODO: add priority
    //.force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

    .force('ceil', d3.forceY(0).strength(fWALL))
    .force('floor', d3.forceY(HEIGHT).strength(fWALL))

    //.force("center", d3.forceY(0).strength(fCENTER))
    //.force("gravity", d3.forceY(nodeGravitySetpoint).strength(fGRAVITY))
    .force('leftBound', forceX(-(width/2), -10, () => true, -1))
    //.force('rightBound', forceX((width/2), -10, () => true, 1))

    .force('centerUpperBound', forceX(COMPLETED_TASK_SETPOINT*width, -10, d => d.task.status != 'complete', 1))
    .force('centerLowerBound', forceX(BLOCKED_SETPOINT*width, -10, d => !d.task.isBlocked, -1))
    .force("complete", forceX(COMPLETED_TASK_SETPOINT*width, fFENCE, d => d.task.status=='complete', -1))
    .force("blocked", forceX(BLOCKED_SETPOINT*width, -1, d => d.task.isBlocked, 1));

  }

  const tickFn = useCallback(() => {
      //const node = svg.select('g#node').selectAll('g');
      const node = nodeRef.current;
      const svg = d3.select(svgRef.current);
      const {width, height} = dimsRef.current;

      node.select('rect')
        .attr('x', d => {
          d.x = constrain(d.x, -width/2, width/2)
          return d.x - (nodeSize(d) / 2)
        })
        .attr('y', d => {
          d.y = constrain(d.y, 0, HEIGHT)
          return d.y - (nodeSize(d) / 2)
        })

      node.select('text')
          .attr('x', d => d.x + LABEL_OFFSET_X)
          .attr('y', d => d.y + LABEL_OFFSET_Y)
          .attr('transform', d => `rotate(-30, ${d.x+LABEL_OFFSET_X}, ${d.y+LABEL_OFFSET_Y})`)

      svg.select('g#link').selectAll('line')
        .attr('x1', d => d.source.x)
        .attr('x2', d => d.target.x)
        .attr('y1', d => d.source.y)
        .attr('y2', d => d.target.y)
      
      svg.select('defs').selectAll('linearGradient')
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      

      d3.select('#debug').select('p.alpha').text(simRef.current.alpha());

  }, [dimsRef])


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
    d3.select('#debug').selectAll('*').remove();
    d3.select('#debug').append('p').classed('alpha',true);

    const width = containerRef.current.getBoundingClientRect().width;

    console.log("Initial dims:", width, HEIGHT);

    svg
      .attr('height', HEIGHT)
      .attr('width', '100%')
      .attr('viewBox', [-width/2, 0, width, HEIGHT])

    svg.select('g#link').attr('stroke-width', COLORS.edge.strokeWidth);

    nodeRef.current = svg.select('g#node')
      .attr('stroke-width', COLORS.node.strokeWidth)
      .attr('stroke', COLORS.node.stroke)
      .selectAll('g');

    const ghostNode = svg.select('g#ghost-node')
      .attr('stroke-width', COLORS.node.strokeWidth)
      .attr('stroke', COLORS.node.stroke)
      .attr('fill', COLORS.node.fillGhost)
      .attr('opacity', COLORS.node.opacityGhost);
    
    svg.select('g#borders').attr('stroke-width', 2)

    buildForceSim()
    simRef.current.on('tick', tickFn);

  }, [width, HEIGHT, tickFn]);

  function resizeEvent() {
    //const container = containerRef.current;
    const svg = d3.select(svgRef.current);
    const {width, height} = dimsRef.current;

    //const {width, height} = {width: dims.x, height: dims.y};
    console.debug("Handling dims change to", width, height);

    svg
      .attr('width', width)
      .attr('viewBox', [-width/2, 0, width, HEIGHT])

    const completedTaskSetpoint = COMPLETED_TASK_SETPOINT * width;
    const blockedSetpoint = BLOCKED_SETPOINT * width;

    const lines = [
      { x: COMPLETED_TASK_SETPOINT*width, color: COLORS.border.complete },
      { x: BLOCKED_SETPOINT*width, color: COLORS.border.blocked }
    ]

    svg.select('g#borders')
      .selectAll('line')
      .data(lines)
      .join('line')
        .attr('stroke', d => d.color)
        .attr('x1', d => d.x)
        .attr('x2',  d => d.x)
        .attr('y1', 0)
        .attr('y2', HEIGHT)

    const viz_regions = svg.select('g#regions')
    function makeRegion(x : number, width : number, fill : string) {
      const region = viz_regions.append('rect')
        .attr('y', 0)
        .attr('height', HEIGHT)
        .attr('x', x)
        .attr('width', width)
        .attr('fill', fill)
        .attr('opacity', 0)

      return region;
    }

    viz_regions.selectChildren('rect').remove();
    const completedTaskRegion = makeRegion(completedTaskSetpoint, width-completedTaskSetpoint, COLORS.region.complete).attr('id','complete');
    const mainTaskRegion = makeRegion(blockedSetpoint, completedTaskSetpoint-blockedSetpoint , COLORS.region.available).attr('id', 'main');
    const blockedTaskRegion = makeRegion((-width/2), blockedSetpoint - (-width/2), COLORS.region.blocked).attr('id','blocked');

    simRef.current
      .force('leftBound', forceX(-(width/2), -10, () => true, -1))
      .force('rightBound', forceX((width/2), -10, () => true, 1))

      .force('centerUpperBound', forceX(COMPLETED_TASK_SETPOINT*width, -10, d => d.task.status != 'complete', 1))
      .force('centerLowerBound', forceX(BLOCKED_SETPOINT*width, -10, d => !d.task.isBlocked, -1))
      .force("complete", forceX(COMPLETED_TASK_SETPOINT*width, fFENCE, d => d.task.status=='complete', -1))
      .force("blocked", forceX(BLOCKED_SETPOINT*width, -1, d => d.task.isBlocked, 1));
  }

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
    simulation.alpha(SIM.ambientWarm).restart();

    nodeRef.current = svg.select('g#node').selectAll('g')
      //.selectAll('rect')
      .data(nodes, (d: Node) => d.task.id)
      .join(
        enter => {
          const obj = enter.append('g');
          obj.append('rect')
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
            .attr('fill', nodeColor)
            .attr('id', d => d.task.id)
            .attr('y', d => (Math.random() * 400) - 200);

          obj.append('text').text(d => d.task.title)
            .attr('font-family', 'Helvetica')
            .attr('font-size', '20px')
            .attr('stroke-weight', '0')
            .attr('stroke', 'none')
            .attr('fill', COLORS.text.fill)
            .attr('transform', d => `rotate(30, ${d.x}, ${d.y})`)
          
          return obj


        },
        update => {
          update.select('rect')
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
          update.select('text').text(d => d.task.title)
          update.select('rect').transition().duration(200)
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
            .attr('fill', nodeColor);
          return update
        }
        ,
        exit => { exit.remove(); }
      );

    // TODO: refactor this in a way that doesn't suck
    if (spawnHint) {
      nodeRef.current.each((d,i) => {
        if (d.id == spawnHint.id) {
          d.x = spawnHint.x;
          d.y = spawnHint.y;
          d.vx = 0;
          d.vy = 0;
        }

      })

      setSpawnHint(null)
    }
    const node = nodeRef.current;


    svg.select('g#link')
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

    
    // Per-node event handlers. This could be moved to the join.
    node.on('click', (e,d) => selectTask(d.id));
    node.on('mouseover.a', hoverNode);
    node.on('mousemove.a', attachTooltipToMouse)
    node.on('mouseout.a', () => d3.select('#tooltip').classed('hidden',true))

    // Add a drag behavior.
    applyDragListener();

    //viz_regions.on('click', e => selectNode());
    viz_regions.on('click', e => selectTask(null));


  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);

  // Set the position attributes of links and nodes each time the simulation ticks.
  // Reheat the simulation when drag starts, and fix the subject position.
  function dragstarted(event, d) {
    console.debug("Drag began on node", d.id)
    const node = d3.select('g#node').selectAll('g');

    if (!event.active) simRef.current.alpha(SIM.ambientWarm).alphaTarget(SIM.ambientWarm).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
    node.on('mouseover.a', null)
    node.on('mousemove.a', null)
    node.on('mouseout.a', null)

    d3.select('#tooltip').classed('hidden',true);

    node.filter(n => n.id == event.subject.id).raise();
    currentClickIsDrag.current = false;
  }


  const dragged = useCallback((event, d) => {
    const targetNode = d;
    const viz_regions = d3.select(svgRef.current).select('g#regions');
    currentClickIsDrag.current = true;

    const {width, height} = dimsRef.current;

    //constrain(d.x, -width/2, width/2)
    event.subject.fx = constrain(event.x, -width/2, width/2)
    event.subject.fy = constrain(event.y, 0, HEIGHT);

    // TODO4: All the dragged triggers for highlighting regions
    if (targetNode.task.status != 'complete') {
      viz_regions.select('#complete')
        .attr('opacity', event.x > COMPLETED_TASK_SETPOINT * width ? 1 : 0)
    }

    if (targetNode.task.status == 'complete') {
      viz_regions.select('#main')
        .attr('opacity', event.x < COMPLETED_TASK_SETPOINT *width&& event.x > BLOCKED_SETPOINT*width ? 1 : 0);

    }

    viz_regions.select('#blocked')
      .attr('opacity', event.x < BLOCKED_SETPOINT * width ? 1 : 0);

  }, [BLOCKED_SETPOINT, dimsRef]);

  const dragended = useCallback((event, d) => {

    if (!currentClickIsDrag.current) {
      console.log("Calling dragended although this was actually a click");
    }

    const {width, height} = dimsRef.current;

    console.debug('Drag ended on node', d.id)

    //const targetNode = event.subject;
    const targetNode = d;

    // Restore the target alpha so the simulation cools after dragging ends.
    if (!event.active) simRef.current.alphaTarget(SIM.alphaTarget);

    // Unfix the subject position now that it’s no longer being dragged.
    targetNode.fx = null;
    targetNode.fy = null;

    // TODO4: All the dragended triggers for highlighting regions
    if (targetNode.x > COMPLETED_TASK_SETPOINT*width
      && targetNode.task.status != 'complete') {

      onCommit([{id: targetNode.id, type: 'complete'}])
    }

    if (targetNode.x < COMPLETED_TASK_SETPOINT *width
      && targetNode.task.status == 'complete') {
      onCommit([{id: targetNode.id, type: 'uncomplete'}])
    }

    if (targetNode.x < BLOCKED_SETPOINT*width && currentClickIsDrag.current) {
      setAddDependencyTask(targetNode.id);
    }


    d3.select(svgRef.current).select('g#regions').selectAll('rect').attr('opacity',0);

    const node = nodeRef.current;
    node.on('mouseover.a', hoverNode);
    node.on('mousemove.a', attachTooltipToMouse)
    node.on('mouseout.a', () => d3.select('#tooltip').classed('hidden',true))


  }, [width])

  function applyDragListener() {
    d3.select('g#node').selectAll('g').call( d3.drag()
      .on("start.d", dragstarted)
      .on("drag.d", dragged)
      .on("end.d", dragended));
  };
/*
 
  █████╗ ██████╗ ██████╗     ██████╗ ███████╗██████╗ ███████╗███╗   ██╗██████╗ ███████╗███╗   ██╗ ██████╗██╗   ██╗    ███████╗███████╗███████╗███████╗ ██████╗████████╗
 ██╔══██╗██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔══██╗██╔════╝████╗  ██║██╔══██╗██╔════╝████╗  ██║██╔════╝╚██╗ ██╔╝    ██╔════╝██╔════╝██╔════╝██╔════╝██╔════╝╚══██╔══╝
 ███████║██║  ██║██║  ██║    ██║  ██║█████╗  ██████╔╝█████╗  ██╔██╗ ██║██║  ██║█████╗  ██╔██╗ ██║██║      ╚████╔╝     █████╗  █████╗  █████╗  █████╗  ██║        ██║   
 ██╔══██║██║  ██║██║  ██║    ██║  ██║██╔══╝  ██╔═══╝ ██╔══╝  ██║╚██╗██║██║  ██║██╔══╝  ██║╚██╗██║██║       ╚██╔╝      ██╔══╝  ██╔══╝  ██╔══╝  ██╔══╝  ██║        ██║   
 ██║  ██║██████╔╝██████╔╝    ██████╔╝███████╗██║     ███████╗██║ ╚████║██████╔╝███████╗██║ ╚████║╚██████╗   ██║       ███████╗██║     ██║     ███████╗╚██████╗   ██║   
 ╚═╝  ╚═╝╚═════╝ ╚═════╝     ╚═════╝ ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═══╝╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝   ╚═╝       ╚══════╝╚═╝     ╚═╝     ╚══════╝ ╚═════╝   ╚═╝   
                                                                                                                                                                       
 
*/

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    const node = svg.select('g#node').selectAll('g')
    const viz_regions = svg.select('g#regions');

    /**
     * Spawn a temporary node in a new layer as a touch target
     * @param x X position to spawn ghost node at
     * @param y Y position to spawn ghost node at
     * @param dependsOn 
     * @param children 
     * @returns d3 selection of the temporary node
     */

    if (!addDependencyTask) {
      // Do cleanup
      console.debug("addDependencyTask was set to", addDependencyTask, "so we are cleaning up");
      cleanup();
      return
    }


    selectTask(addDependencyTask)

    console.debug("Adding dependency for", addDependencyTask);
    // enter "Add dependency" mode
    freezeSim();
    node.on('.drag', null) // remove drag listeners


    node.filter(d => d.id != addDependencyTask)
      .on('click.block', (event, d) => {
        console.debug("In add dep mode, we saw click.block on", d.id);
        onCommit([{id: addDependencyTask, type: 'block', blockerId: d.id}])
        cleanup();
        selectTask(d.id);
        setAddDependencyTask(null);
      })

    const childNode = simDataRef.current.nodes.find(d => d.id == addDependencyTask);


    // Add "ghost node"
    // TODO6: Alter ghost node spawn point
    const [ghostX, ghostY] = [childNode.x, childNode.y-100]
    const ghostLine = tempLine(childNode.x, childNode.y,ghostX,ghostY)
    const ghostNode = tempNode(ghostX, ghostY)
    ghostNode.on('click', () => { 
      const newID = generateID();
      onCommit([
        { id: newID, type: 'add' }, 
        { id: childNode.id, type: 'block', blockerId: newID }
      ]);

      setSpawnHint({id: newID, x: ghostX, y: ghostY});

      cleanup();
      setAddDependencyTask(null);
      selectTask(newID);
    })
    
    viz_regions.on('click.resume', (event, d) => {
      // kindly cancel
      console.debug('Resuming without changes');
      cleanup();
      setAddDependencyTask(null);
    });

    console.debug("sim entered add dependency mode");

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addDependencyTask])

  // Update the subject (dragged node) position during drag.

  useEffect(() => { // on selectedTask change
    nodeRef.current
      .attr('stroke', null)
      .classed('selected', false)
      .filter(d => d.id === selectedTask)
        .attr('stroke', COLORS.node.strokeSelected)
        .classed('selected', true)
        .raise();

  }, [selectedTask]);

  useEffect(() => {
    console.debug("Config updating", vizConfig)

    d3.select(svgRef.current).selectAll('g#node g text').style('visibility', vizConfig.showLabels ? undefined : 'hidden');
  }, [vizConfig])


  return (
    <div style={{border:'0px dotted blue'}} id='svg-container' ref={containerRef}>
    <svg ref={svgRef} width='100%' viewBox='0 0 {defaultWidth} {defaultHeight}'>
      <g id="regions"></g>
      <g id="borders"></g>
      <defs></defs>
      <g id="link"></g>
      <g id="ghost-link"></g>
      <g id='node'></g>
      <g id='ghost-node'></g>
    </svg>
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

export default function App({user}) {

  const [tasks, setTasks] = useState<TaskMap>(testDict['snapshot'])
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])

  const [selectedTaskID, setSelectedTaskID] = useState<string>();
  const [hoveredTaskID, setHoveredTaskID] = useState<string>();
  const [addDependencyTaskID, setAddDependencyTaskID] = useState<string>();

  const save = () => saveTasks(solvedTasks);
  const load = () => getTasks().then(data => setTasks(data))
  //const load = () => setTasks(getTasks())

  const [vizConfig, setVizConfig] = useState({
    showLabels: true
  })

  
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

  function selectTask(taskID) {
    setSelectedTaskID(taskID);
  }

  const [expanded, setExpanded] = useState<boolean>(false)

  return (
    <>
      <div className='buttonbar'>
        {/* <Button onClick={save}><BsFillCloudUploadFill />Upload</Button> */}
        {/* <Button onClick={load}> <BsFillCloudDownloadFill /> Download</Button> */}
        <Toggle onClick={e => setVizConfig({...vizConfig, showLabels: !vizConfig.showLabels})}>
          <Tag />Labels{ vizConfig.showLabels ? <BsCheck /> : <BsX /> }
        </Toggle>

        {/* <Toggle disabled>{} <Play/><Pause/>Freeze simulation</Toggle> */}
        <span className='spacer'></span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <UserIcon />
              {user}
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className='w-60 l-5'>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={vizConfig.showLabels}
                onCheckedChange={b => setVizConfig({...vizConfig, showLabels: b})}>
                <Tag />
                Show labels
              </DropdownMenuCheckboxItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Filter/>Filters</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuCheckboxItem>Show completed tasks</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem>Show blocked tasks</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem>Show hidden tasks</DropdownMenuCheckboxItem>

                    </DropdownMenuSubContent>
                </DropdownMenuSub>
              <DropdownMenuItem disabled>
                <Undo2 />Undo
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <Redo2/>Redo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sync</DropdownMenuLabel>
              <DropdownMenuItem onClick={save}>
                <Save stroke='black'/>
                Upload
              </DropdownMenuItem>
              <DropdownMenuItem onClick={load}>
                <CloudDownload stroke='black'/>
                Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </DropdownMenuGroup>

          <DropdownMenuGroup>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem variant='destructive'
              onClick={e => supabase.auth.signOut({scope: 'global'})}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      <Sim tasks={solvedTasks} selectTask={selectTask} 
        hoverTask={setHoveredTaskID}
        onCommit={handleCommits}
        selectedTask={selectedTaskID}
        addDependencyTask={addDependencyTaskID}
        setAddDependencyTask={setAddDependencyTaskID}
        vizConfig={vizConfig}/>
      
      <Inspect tasks={solvedTasks} selectTask={selectTask} 
        taskID={selectedTaskID} 
        onCommit={handleCommit}
        addDependencyTask={addDependencyTaskID}
        setAddDependencyTask={setAddDependencyTaskID}
      />

      <div id='list-container' style={{flex: selectedTaskID ? '0 1 0' : undefined }}>
        <ListView tasks={solvedTasks} selectTask={selectTask} 
          onCommit={handleCommit}/>
      </div>


      <Tooltip tasks={tasks} taskID={hoveredTaskID}/>
      <div id='debug'>{addDependencyTaskID}</div>
    </>
  )

}

window.d3 = d3;

//export default App
