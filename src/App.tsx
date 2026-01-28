/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useRef, useEffect, useMemo } from 'react'
import '@/styles/App.css';
import * as d3 from 'd3'
import { saveTasks, getTasks, calculate, processIntent, type Task, type CommitEvent } from './Tasks.ts';
import { Inspect, Tooltip, ListView} from './Inspect.tsx';
import { generateID } from './Domain.ts'

import { BsFillCloudUploadFill, BsFillCloudDownloadFill, BsCheck, BsX } from "react-icons/bs";
import {testDict} from './data.js';
import { Button } from './components/ui/button.tsx';
import { CloudDownload, CloudUpload, Tag, UserIcon, LogOutIcon, ChevronDown } from 'lucide-react';
import { Toggle } from './components/ui/toggle.tsx';

import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem, 
  DropdownMenuContent, DropdownMenuGroup, 
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuItem, DropdownMenuLabel 
} from '@/components/ui/dropdown-menu.tsx';
import { supabase } from './lib/supabase/client.ts';

// Fence locations
const COMPLETED_TASK_SETPOINT = 150;
const GRAVITY_SETPOINT = 150;
const BLOCKED_SETPOINT = 400;

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
const rCOLLISION = 20;
const fWALL = 0.0006;
//const COMPLETED_TASK = 15 * FORCE_SCALAR;

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
  alphaDecay: 0.001,
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
      x: (Math.random() * 400) - 200,
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
  const simRef = useRef<d3.Simulation<Node, undefined> | null>(null);
  const simDataRef = useRef<{nodes: Node[], links: Link[]}>({nodes: [], links: []});
  const solvedTasks = useMemo( () => calculate(tasks), [tasks])
  const containerRef = useRef(null);
  const [spawnHint, setSpawnHint] = useState<SpawnHint | null>(null);
  const nodeRef = useRef(null);
  let currentClickIsDrag = false;


  const height = 500;
  const width = 1400;

  const container = d3.select(containerRef.current)
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
    d3.select('#debug').selectAll('*').remove();
    d3.select('#debug').append('p');

    document.querySelector('#svg-container').scrollTo(400,0);

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
      .force("collide", d3.forceCollide(d => nodeSize(d) / 2)) // TODO: add priority
      //.force("collide", d3.forceCollide(rCOLLISION)) // TODO: add priority
      //.force("link", d3.forceLink(links).id(d => d.id).strength(fLINK))

      .force('leftWall', d3.forceX(-200).strength(fWALL))
      .force('rightWall', d3.forceX(200).strength(fWALL))

      .force("center", d3.forceX(0).strength(fCENTER))
      .force("gravity", d3.forceY(nodeGravitySetpoint).strength(fGRAVITY))

      .force('centerUpperBound', forceY(COMPLETED_TASK_SETPOINT, -10, d => d.task.status != 'complete', -1))
      .force('centerLowerBound', forceY(BLOCKED_SETPOINT, -10, d => !d.task.isBlocked))
      .force("complete", forceY(COMPLETED_TASK_SETPOINT, fFENCE, d => d.task.status=='complete'))
      .force("blocked", forceY(BLOCKED_SETPOINT, -1, d => d.task.isBlocked, -1));

    simRef.current = sim;

    const link = svg.append('g')
      .attr('id', 'link')
      .attr('stroke-width', COLORS.edge.strokeWidth);

    const ghostLink = svg.append('g').attr('id', 'ghost-link')

    nodeRef.current = svg.append('g')
      .attr('id', 'node')
      .attr('stroke-width', COLORS.node.strokeWidth)
      .attr('stroke', COLORS.node.stroke)
      .selectAll('g');

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



    sim.on('tick', () => {

      //const node = svg.select('g#node').selectAll('g');
      const node = nodeRef.current;

      node.select('rect')
        .attr('x', d => {
          d.x = constrain(d.x, -width/2, width/2)
          return d.x - (nodeSize(d) / 2)
        })
        .attr('y', d => {
          d.y = constrain(d.y, 0, height)
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
      

      d3.select('#debug').select('p').text(sim.alpha());
    });

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

    //width = +svg.attr('width');
    //height = +svg.attr('height');

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
            .attr('x', d => (Math.random() * 400) - 200);

          obj.append('text').text(d => d.task.title)
            //.attr('stroke', '#fff')
            //.attr('font-weight', '1')
            .attr('font-family', 'Helvetica')
            .attr('font-size', '20px')
            .attr('stroke-weight', '0')
            .attr('stroke', 'none')
            //.attr('stroke-weight', '0.1')
            .attr('fill', COLORS.text.fill)
            .attr('transform', d => `rotate(30, ${d.x}, ${d.y})`)
          
          return obj


        },
        update => {
          update.select('rect')
            .attr('width', nodeSize) 
            .attr('height', nodeSize) 
          update.select('rect').transition().duration(200)
            .attr('rx', d => d.task.isExternal ? 3 : nodeSize(d)) 
            .attr('ry', d => d.task.isExternal ? 3 : nodeSize(d))
            .attr('fill', nodeColor);
          return update
        }
        ,
        exit => { exit.remove(); }
      );

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

    
    // Per-node event handlers. This could be moved to the join.
    node.on('click', (e,d) => selectTask(d.id));
    node.on('mouseover.a', hoverNode);
    node.on('mousemove.a', attachTooltipToMouse)
    node.on('mouseout.a', () => d3.select('#tooltip').classed('hidden',true))

    //node.append('title').text(d => d.task.title);
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
    currentClickIsDrag = false;
  }

  function dragged(event) {
    const targetNode = event.subject;
    const viz_regions = d3.select(svgRef.current).select('g#regions');
    currentClickIsDrag = true;

    //constrain(d.x, -width/2, width/2)
    event.subject.fx = constrain(event.x, -width/2, width/2)
    event.subject.fy = constrain(event.y, 0, height);

    if (targetNode.task.status != 'complete') {

      if (event.y < COMPLETED_TASK_SETPOINT) {
        viz_regions.select('#complete').attr('opacity', 1)

      } else {
        viz_regions.select('#complete').attr('opacity', 0)
      }
    }

    if (targetNode.task.status == 'complete') {
      if (event.y > COMPLETED_TASK_SETPOINT && event.y < BLOCKED_SETPOINT) {
        viz_regions.select('#main').attr('opacity', 1)

      } else {
        viz_regions.select('#main').attr('opacity', 0)
      }

    }

    if (event.y > BLOCKED_SETPOINT) {
      viz_regions.select('#blocked').attr('opacity', 1)
    } else {
      viz_regions.select('#blocked').attr('opacity', 0)
    }

  }

  function dragended(event,d) {

    if (!currentClickIsDrag) {
      console.log("Calling dragended although this was actually a click");
    }

    console.debug('Drag ended on node', d.id)

    //const targetNode = event.subject;
    const targetNode = d;

    // Restore the target alpha so the simulation cools after dragging ends.
    if (!event.active) simRef.current.alphaTarget(SIM.alphaTarget);

    // Unfix the subject position now that it’s no longer being dragged.
    event.subject.fx = null;
    event.subject.fy = null;

    if (targetNode.y < COMPLETED_TASK_SETPOINT
      && targetNode.task.status != 'complete') {

      onCommit([{id: targetNode.id, type: 'complete'}])
    }

    if (targetNode.y > COMPLETED_TASK_SETPOINT 
      && targetNode.task.status == 'complete') {
      onCommit([{id: targetNode.id, type: 'uncomplete'}])
    }

    if (targetNode.y > BLOCKED_SETPOINT && currentClickIsDrag) {
      setAddDependencyTask(targetNode.id);
    }


    const viz_regions = d3.select(svgRef.current).select('g#regions');
    viz_regions.select('#complete').attr('opacity', 0)
    viz_regions.select('#main').attr('opacity', 0)
    viz_regions.select('#blocked').attr('opacity', 0)
    //nodes = recalculate(nodes);

    const node = nodeRef.current;
    node.on('mouseover.a', hoverNode);
    node.on('mousemove.a', attachTooltipToMouse)
    node.on('mouseout.a', () => d3.select('#tooltip').classed('hidden',true))

  }

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


/*
 
 ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗██║   ██║██████╔╝███████║   ██║   ██║██║   ██║██╔██╗ ██║
██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║██║   ██║██╔══██╗██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝╚██████╔╝██║  ██║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
                                                                                                                
 
*/

  useEffect(() => {
    console.debug("Config updating", vizConfig)

    d3.select(svgRef.current).selectAll('g#node g text').style('visibility', vizConfig.showLabels ? undefined : 'hidden');
  }, [vizConfig])


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
          { vizConfig.showLabels ? <BsCheck /> : <BsX /> }
        Labels</Toggle>
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
              <DropdownMenuSeparator />
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sync</DropdownMenuLabel>
              <DropdownMenuItem onClick={e => console.log("upload")}>
                <CloudUpload stroke='black'/>
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
