// Import Express module
const express = require('express');

// Initialize the Express application
const app = express();
const port = 5000;

// Middleware to parse incoming JSON requests
app.use(express.json());

// 1. Global Logging Middleware
// Logs the HTTP Method, URL, and Timestamp for every incoming request
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${req.method} ${req.url} - ${timestamp}`);
    next();
});

// 2. Data Storage
// In-memory array to store our tasks (No database used)
let tasks = [];
let nextId = 1;

// 3. CRUD APIs

// GET /tasks
// Returns all tasks with status 200
app.get('/tasks', (req, res) => {
    res.status(200).json(tasks);
});

// POST /tasks
// Creates a new task and returns it with status 201
app.post('/tasks', (req, res) => {
    const { title } = req.body;
    
    // Create the new task object
    const newTask = {
        id: nextId++,
        title: title
    };
    
    // Add to our in-memory array
    tasks.push(newTask);
    
    // Return the created task
    res.status(201).json(newTask);
});

// PUT /tasks/:id
// Updates the title of an existing task. Returns 404 if not found.
app.put('/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { title } = req.body;
    
    // Find the task in the array
    const task = tasks.find(t => t.id === id);
    
    if (!task) {
        // If task doesn't exist, return 404
        return res.status(404).json({ error: "Task not found" });
    }
    
    // Update the task title
    task.title = title;
    
    // Return updated task
    res.status(200).json(task);
});

// DELETE /tasks/:id
// Deletes a task by ID. Returns 404 if not found.
app.delete('/tasks/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    
    // Find the index of the task
    const taskIndex = tasks.findIndex(t => t.id === id);
    
    if (taskIndex === -1) {
        // If task doesn't exist, return 404
        return res.status(404).json({ error: "Task not found" });
    }
    
    // Remove the task from the array
    tasks.splice(taskIndex, 1);
    
    // Return success message
    res.status(200).json({ message: "Task successfully deleted" });
});

// 4. Global Error Handling Middleware
// Must be the LAST app.use(). Catches any unhandled errors.
app.use((err, req, res, next) => {
    res.status(500).json({ error: "Something went wrong" });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
