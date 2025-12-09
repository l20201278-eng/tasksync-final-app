// server/index.js - Versión Final Segura

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const mongoose = require('mongoose');      
const bcrypt = require('bcrypt');          
const jwt = require('jsonwebtoken');       
const dotenv = require('dotenv');          

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'MY_SUPER_SECRET_KEY'; 
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tasksync-db'; 

// ----------------------------------------------------
// 1. CONEXIÓN A MONGODB
// ----------------------------------------------------

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conexión a MongoDB exitosa'))
    .catch(err => console.error('❌ Error de conexión a MongoDB:', err.message));

// ----------------------------------------------------
// 2. MODELOS (Usuario, Tarea, Lista Negra)
// ----------------------------------------------------

// A. Modelo de Usuario (Igual que el tuyo)
const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    username: { type: String, required: true }
});
UserSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});
const User = mongoose.model('User', UserSchema);

// B. Modelo de Tarea (Añadido: Debe ser de Mongoose, no array local)
const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    completed: { type: Boolean, default: false },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } // Para saber a quién pertenece
});
const Task = mongoose.model('Task', TaskSchema);

// C. Modelo de Lista Negra (Opción C)
const InvalidTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now, expires: '1h' } 
});
const InvalidToken = mongoose.model('InvalidToken', InvalidTokenSchema);


// ----------------------------------------------------
// 3. MIDDLEWARES y CONFIGURACIÓN
// ----------------------------------------------------

// Inicialización de Socket.IO
const io = new Server(server, {
    cors: {
        origin: "http://localhost:4200", 
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

// Middleware clave para procesar el req.body y CORS para Express
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json()); 


// 🛡️ Middleware para verificar JWT y Lista Negra
const verifyToken = async (req, res, next) => {
    const tokenHeader = req.headers['authorization'];
    if (!tokenHeader || !tokenHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    const tokenString = tokenHeader.split(' ')[1];
    
    // 🛑 1. VERIFICACIÓN DE LISTA NEGRA (Opción C)
    try {
        const isBlacklisted = await InvalidToken.findOne({ token: tokenString });
        if (isBlacklisted) {
            return res.status(401).json({ message: 'Acceso denegado: Sesión cerrada.' });
        }
    } catch (err) {
        return res.status(500).json({ message: 'Error en servidor al verificar sesión.' });
    }
    
    // 2. VERIFICACIÓN DE JWT
    try {
        const decoded = jwt.verify(tokenString, JWT_SECRET);
        req.user = decoded; // { id: user._id, email: user.email }
        next();
    } catch (err) {
        res.status(403).json({ message: 'Token inválido o expirado.' });
    }
};


// ----------------------------------------------------
// 4. RUTAS DE AUTENTICACIÓN Y LOGOUT (Opción C)
// ----------------------------------------------------

const authRouter = express.Router();

// Ruta: /api/register (Igual que el tuyo)
authRouter.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ username, email, password });
        await newUser.save();
        res.status(201).json({ message: 'Registro exitoso.' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'El correo ya está registrado.' });
        }
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Ruta: /api/login (Igual que el tuyo)
authRouter.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Credenciales inválidas.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Credenciales inválidas.' });

        const token = jwt.sign(
            { id: user._id, email: user.email, username: user.username }, // Añadido username al token
            JWT_SECRET, 
            { expiresIn: '1h' }
        );
        return res.json({ message: 'Inicio de sesión exitoso', token }); 

    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// Ruta: /api/logout (Opción C: Agregar a Lista Negra)
authRouter.post('/logout', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(400).send('Token missing.');
    }

    const token = authHeader.split(' ')[1];

    try {
        const invalidToken = new InvalidToken({ token });
        await invalidToken.save();
        res.status(200).send('Logged out successfully. Token invalidated.');
    } catch (err) {
        // 11000 = Duplicado (token ya invalidado, no es un error crítico)
        if (err.code === 11000) {
             return res.status(200).send('Token already invalidated.');
        }
        res.status(500).send('Error invalidating token.');
    }
});

app.use('/api', authRouter); 

// ----------------------------------------------------
// 5. RUTAS DE TAREAS (Usan MongoDB)
// ----------------------------------------------------

// GET: Obtener solo las tareas del usuario autenticado
app.get('/tasks', verifyToken, async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.user.id });
        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener tareas.' });
    }
});

// POST: Crear nueva tarea
app.post('/tasks', verifyToken, async (req, res) => {
    try {
        const newTask = new Task({
            title: req.body.title,
            completed: req.body.completed || false,
            userId: req.user.id // Asignar la tarea al usuario autenticado
        });
        await newTask.save();
        
        io.emit('taskAdded', newTask); // Notificar a todos los clientes (idealmente solo al grupo del usuario)
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear tarea.' });
    }
});

// PUT: Actualizar tarea
app.put('/tasks/:id', verifyToken, async (req, res) => {
    try {
        const updatedTask = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id }, // Busca por ID y verifica que pertenezca al usuario
            { title: req.body.title, completed: req.body.completed },
            { new: true } // Devuelve el documento actualizado
        );

        if (!updatedTask) {
            return res.status(404).send('Tarea no encontrada o no pertenece al usuario.');
        }
        
        io.emit('taskUpdated', updatedTask);
        res.json(updatedTask);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar tarea.' });
    }
});

// DELETE: Eliminar tarea
app.delete('/tasks/:id', verifyToken, async (req, res) => {
    try {
        const result = await Task.deleteOne({ _id: req.params.id, userId: req.user.id });

        if (result.deletedCount === 0) {
            return res.status(404).send('Tarea no encontrada o no pertenece al usuario.');
        }
        
        io.emit('taskDeleted', req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error al eliminar tarea.' });
    }
});

// ----------------------------------------------------
// 6. INICIO DE SERVIDOR Y SEGURIDAD DE SOCKET.IO
// ----------------------------------------------------

// 🛑 MIDDLEWARE DE AUTENTICACIÓN SOCKET.IO 🛑
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) return next(new Error("Authentication error: Token missing."));

    // [OPCIONAL] VERIFICACIÓN DE LISTA NEGRA (Mismo check que en el middleware REST)
    /*
    const isBlacklisted = await InvalidToken.findOne({ token });
    if (isBlacklisted) return next(new Error("Authentication error: Token has been logged out."));
    */

    try {
        const decoded = jwt.verify(token, JWT_SECRET); 
        socket.user = decoded; 
        next();
    } catch (err) {
        return next(new Error("Authentication error: Invalid or expired token."));
    }
});


// Manejo de eventos para conexiones AUTENTICADAS
io.on('connection', (socket) => {
    // Solo llegamos aquí si el token es válido
    console.log(`✅ Usuario autenticado conectado vía Socket.IO. User ID: ${socket.user.id}`);
    
    // Aquí puedes configurar la lógica para emitir eventos a este usuario.

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado. ID: ${socket.user.id}`);
    });
});

server.listen(port, () => {
    console.log(`🚀 Servidor de tareas/auth escuchando en http://localhost:${port}`);
});