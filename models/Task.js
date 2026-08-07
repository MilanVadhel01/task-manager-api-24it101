// Import Mongoose to define a schema and model
const mongoose = require('mongoose');

// ─────────────────────────────────────────────
// TASK SCHEMA
// Defines the shape of every task document
// stored in the MongoDB "tasks" collection.
// ─────────────────────────────────────────────
const taskSchema = new mongoose.Schema({

    // Title of the task — required field
    title: {
        type: String,
        required: [true, 'Title is required']
    },

    // Optional description of the task
    description: {
        type: String
    },

    // Whether the task is done — defaults to false
    completed: {
        type: Boolean,
        default: false
    },

    // When the task was created — defaults to now
    createdAt: {
        type: Date,
        default: Date.now
    },

    // Supplementary Problem 1:
    // Priority level for the task
    // Only allows the three listed values
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'low'
    }

});

// ─────────────────────────────────────────────
// Supplementary Problem 2:
// PRE-SAVE HOOK
// Runs automatically before every .save() call.
// Trims extra whitespace from the title.
// ─────────────────────────────────────────────
taskSchema.pre('save', async function () {
    // 'this' refers to the document being saved
    // Trim whitespace from the title before saving
    if (this.title) {
        this.title = this.title.trim();
    }
    // No need to call next() with async — Mongoose 8.x handles it automatically
});

// Create the Mongoose model from the schema
// Mongoose will use the collection "tasks" in MongoDB
const Task = mongoose.model('Task', taskSchema);

// Export so server.js can use it
module.exports = Task;
