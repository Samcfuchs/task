import * as d3 from 'd3';
import type { Task } from './Tasks';

type Node = d3.SimulationNodeDatum & {
  id: string,
  group?: number,
  task: Task,
  hovered: boolean
}
type Link = { source: string, target: string, id: string };

// Fence parameters
const fFENCE = -1;
const FENCE_DECAY = -30;

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


/** Constrain a number between min and max */
export function clamp (n : number, min : number, max : number) : number {
  return Math.min(Math.max(n,min), max)
}

/** Get the hex color of a node based on its properties */
export function nodeColor( node : Node ) : string {
  //if (node.task.isExternal) { return '#39f'}
  if (node.task.status == 'complete') { return COLORS.node.fillComplete }
  if (node.task.isBlocked) { return COLORS.node.fillBlocked }
  return COLORS.node.fillAvailable;
}

/** Get the radius of a node based on its properties */
export function nodeSize(node: Node | null) : number {
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

export function forceY(y0 : number, strength : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
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
      node.vy = clamp(a, -10, 10) + (node.vy ?? 0)
    }
  }

  force.initialize = (n : Node[]) => {nodes = n};

  return force;
}

export function forceX(x0 : number, strength : number, nodeFilter : (n: Node) => boolean, direction : 1 | -1 = 1) {
  let nodes : Node[];
  const dir = direction ? direction : 1;
  const fIB = strength;
  const decay = FENCE_DECAY;
  function force(alpha : number) {
    for (const node of nodes) {
      if (!nodeFilter(node)) continue;
      if (!node.x) continue;

      const dy = (node.x - x0) * dir; // Positive when below line
      let a = fIB * Math.exp(-dy / decay) * alpha * dir;
      a = clamp(a, -10, 10);

      node.vx = a + (node.vx ?? 0)
    }
  }

  force.initialize = (n : Node[]) => {nodes = n};

  return force;
}

/*
export class Simulation extends d3.forceSimulation<Node, Link> {

    _nodes = []

    constructor(nodes : Node) {
        super();
    }
}
    */
