// server/index.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:4200", 
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json()); 

// Base de Datos Simple en Memoria
let tasks = [
    { id: uuidv4(), title: 'Configurar Backend', completed: true },
    { id: uuidv4(), title: 'Crear Componente de Lista', completed: false },
    { id: uuidv4(), title: 'Integrar Socket.IO en el Frontend', completed: false }
];

// Endpoints REST
app.get('/tasks', (req, res) => {
    res.json(tasks);
});

app.post('/tasks', (req, res) => {
    const newTask = {
        id: uuidv4(),
        title: req.body.title,
        completed: req.body.completed || false
    };
    tasks.push(newTask);
    io.emit('taskAdded', newTask); // 💡 Socket.IO
    res.status(201).json(newTask);
});

app.put('/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const taskIndex = tasks.findIndex(t => t.id === taskId);

    if (taskIndex > -1) {
        tasks[taskIndex].title = req.body.title || tasks[taskIndex].title;
        tasks[taskIndex].completed = req.body.completed !== undefined ? req.body.completed : tasks[taskIndex].completed;
        io.emit('taskUpdated', tasks[taskIndex]); // 💡 Socket.IO
        res.json(tasks[taskIndex]);
    } else {
        res.status(404).send('Tarea no encontrada');
    }
});

app.delete('/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id !== taskId);

    if (tasks.length < initialLength) {
        io.emit('taskDeleted', taskId); // 💡 Socket.IO
        res.status(204).send();
    } else {
        res.status(404).send('Tarea no encontrada');
    }
});

// Configuración de Socket.IO
io.on('connection', (socket) => {
  console.log('Un usuario se ha conectado:', socket.id);
  socket.on('disconnect', () => {
    console.log('Usuario desconectado:', socket.id);
  });
});

// Iniciar Servidor
server.listen(port, () => {
  console.log(`Servidor de tareas escuchando en http://localhost:${port}`);
});