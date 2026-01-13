import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';

const port = process.env.PORT || 3000;
const server = http.createServer(app);

const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174'
].filter(Boolean);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling']
});

app.set('io', io);

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        if (!token) return next(new Error('Authentication error: Token missing'));

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) return next(new Error('Authentication error: Invalid token'));

        socket.user = decoded;

        const projectId = socket.handshake.query.projectId;
        if (projectId && mongoose.Types.ObjectId.isValid(projectId)) {
            socket.project = await projectModel.findById(projectId).populate('users', 'email');
            if (!socket.project) return next(new Error('Project not found'));
        }

        next();
    } catch (error) {
        console.error('Socket authentication error:', error.message);
        next(error);
    }
});

io.on('connection', socket => {
    console.log(`Socket connected: ${socket.id}`);
    
    if (socket.user) {
        const userRoom = socket.user._id || socket.user.email;
        socket.join(userRoom);
        console.log(`✅ User ${socket.user.email} joined personal room: ${userRoom}`);
    }

    if (socket.project) {
        socket.roomId = socket.project._id.toString();
        socket.join(socket.roomId);
        console.log(`User ${socket.user.email} connected to project ${socket.roomId}`);
    }

    socket.on('project-message', async data => {
        try {
            const message = data.message;
            if (!message || typeof message !== 'string') {
                socket.emit('error', { message: 'Invalid message format' });
                return;
            }

            socket.broadcast.to(socket.roomId).emit('project-message', data);

            if (message.includes('@ai')) {
                io.to(socket.roomId).emit('ai-typing', { isTyping: true });
                
                try {
                    const prompt = message.replace('@ai', '').trim();
                    if (!prompt) {
                        io.to(socket.roomId).emit('project-message', {
                            message: 'Please provide a prompt after @ai',
                            sender: { _id: 'ai', email: 'AI' }
                        });
                        io.to(socket.roomId).emit('ai-typing', { isTyping: false });
                        return;
                    }

                    const result = await generateResult(prompt);
                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });

                    if (result.error) {
                        io.to(socket.roomId).emit('project-message', {
                            message: result.text,
                            sender: { _id: 'ai', email: 'AI' },
                            error: true,
                            errorType: result.errorType
                        });
                        return;
                    }

                    io.to(socket.roomId).emit('project-message', {
                        message: result.text || JSON.stringify(result),
                        sender: { _id: 'ai', email: 'AI' },
                        fileTree: result.fileTree,
                        buildCommand: result.buildCommand,
                        startCommand: result.startCommand
                    });
                } catch (aiError) {
                    console.error('AI Generation Error:', aiError.message);
                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });
                    io.to(socket.roomId).emit('project-message', {
                        message: 'Sorry, I encountered an error processing your request.',
                        sender: { _id: 'ai', email: 'AI' },
                        error: true
                    });
                }
            }
        } catch (error) {
            console.error('Message handling error:', error.message);
            socket.emit('error', { message: 'Failed to process message' });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);
        if (socket.roomId) {
            socket.leave(socket.roomId);
        }
    });

    socket.on('error', error => console.error('Socket error:', error.message));
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, closing server gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

server.listen(port, () => console.log(`Server is running on port ${port}`));
