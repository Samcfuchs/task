# TODO

The irony of using markdown to track to-do items for a to-do list app is not
lost on me.

- [x] Click details
- [x] Hover tooltip
- [x] Add blockers (isExternal)
- [x] Force simulation
- [x] Free dependent points when point is updated
- [x] Viz interactions
    - [x] Add nodes
    - [x] "Add blocker" flow
    - [ ] Select newly added nodes
- [x] Add floating labels
- [ ] Inspector
    - [x] Add markdown descriptions
    - [x] Design a cool checkbox
    - [x] Modifiable dependency view
    - [ ] Allow adding dependency from inspector
    - [x] Priority modal
    - [x] External modal
    - [ ] Make the checkbox do something
    - [ ] Make selection consistently highlight the correct node
    - [ ] Save changes more consistently
- [x] Horizontal panning (for mobile?)
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
- [ ] Alpha deployment
    - [x] Create exploratory task tree
    - [ ] Splash screen

----

- [ ] Enrich tasks
    - [ ] Add goals
    - [ ] Recurring tasks
    - [ ] Add due dates
    - [ ] Add "in progress" state
- [x] List view
    - [x] Implement de-select node
    - [x] Layout
    - [ ] Design
    - [ ] Interact with viz
- [ ] Visual sugar
    - [ ] Animate completion modal on isExternal
    - [ ] Improve the checkbox
    - [ ] Improve performance (seeing frame drops in firefox)
    - [ ] Animate node size changes
    - [ ] Node trashcan
    - [ ] Label regions
    - [ ] Highlight connected nodes on selection
    - [ ] Make the floating labels look good
    - [ ] Allow more customization
        - [ ] Set color coding
        - [ ] Set size coding
- [ ] Prohibit cyclical dependencies (not so important bc deps can be deleted)

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

I haven't yet added this because it's actually quite annoying to have the viz
freeze every time a node is dragged. This can be avoided for now by always
dragging into the "neutral" available zone and implementing this behavior would
make that impossible.


## User Testing notes

1. Changes aren't saved consistently
2. It's not obvious which node is selected all the time
3. Adding a dependency for a completed node requires me to drag it all the way
   to blocked, and then it's also marked as incomplete again
4. It's actually kind of annoying to have the nodes drift horizontally. Makes
   them hard to organize and distinguish
5. I actually do kind of want a save button
6. There should be an obvious way to create a new task. "Add dependency" will
   not cut it.
7. Creating a new node should select it!!!
8. The viz should cool down all the way.
9. I want to anchor some nodes in place.
10. Definitely observing some lag. Doesn't feel snappy.
11. Titlebar could be bigger, honestly.
12. Markdown styling is inconsistent.
13. Dependency view is weird.
14. There should maybe be a system for auto-pruning dependencies.
15. Some bug caused dependency lines to be drawn outside of the main area.

