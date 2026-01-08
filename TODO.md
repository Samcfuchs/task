# TODO

The irony of using markdown to track to-do items for a to-do list app is not
lost on me.

- [x] Click details
- [x] Hover tooltip
- [x] Add blockers (isExternal)
- [x] Force simulation
- [x] Free dependent points when point is updated
- [ ] Interactions
    - [ ] Add nodes
    - [ ] Remove nodes
    - [ ] "Add blocker" flow
- [ ] Add due dates
- [ ] Allow more customization
    - [ ] Set color coding
    - [ ] Set size coding
- [ ] Add goals
- [ ] Horizontal panning (for mobile?)
- [ ] Actually do some mobile testing
- [ ] Live reactive
    - [ ] Zoom (horizontal)
- [ ] Backend
    - [x] Write data models
    - [x] Get save/load running
    - [x] Support cloud DB backend
    - [x] Serve assets from FastAPI
    - [ ] Support multiple users
        - [ ] Implement authentication
        - [ ] Support multi-user in database
- [ ] Recurring tasks
- [ ] Alpha deployment
    - [ ] Create exploratory task tree
    - [ ] Splash screen

## Notes on Forces

Currently: Nodes are fenced into their areas by exponential forces at the
borders.

## Add blocker flow

Pretty much every task should have a task that depends on it. Aren't you always
doing something so you can get to the next thing? The main way we add tasks is
by indicating that an existing task is blocked by something (internal OR
external). The behavior that indicates this is dragging a node down into the
blocked zone, which should present the user with two options: 1. Add a new task
or 2. Identify an existing task which must be completed to make the dependent
task available.

When node A is dragged below ADD_DEPENDENCY:

1. Insert a "ghost node" B above A, dependent on it, as a touch target
2. Freeze the graph
3. Prompt the user to select a blocker--they can select any existing task or
   node B, a new task.
4. IF they select node B, open a "New task" dialog
5. IF they select an existing node, add that dependency
6. Unfreeze the graph

## Remove blocker flow

When BLOCKED node A is dragged into AVAILABLE:

1. Freeze the graph
2. Highlight the nodes that A depends on and prompt to select a dependency to
   remove
3. IF they select a node, remove that dependency and unfreeze

Note that node A may still be blocked if it depends on multiple incomplete
nodes. It should stay blocked and return to the BLOCKED region. User repeats the
previous action to remove more dependencies.


