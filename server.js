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

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }

        // FIX: Populate users array with full user details
        socket.project = await projectModel.findById(projectId).populate('users', 'email');

        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        if (!token) {
            return next(new Error('Authentication error: Token missing'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error: Invalid token'));
        }

        socket.user = decoded;
        next();

    } catch (error) {
        console.error('Socket authentication error:', error.message);
        next(error);
    }
});

io.on('connection', socket => {
    socket.roomId = socket.project._id.toString();
    console.log(`User ${socket.user.email || socket.user._id} connected to project ${socket.roomId}`);
    
    socket.join(socket.roomId);

    socket.on('project-message', async data => {
        try {
            const message = data.message;

            if (!message || typeof message !== 'string') {
                socket.emit('error', { message: 'Invalid message format' });
                return;
            }

            socket.broadcast.to(socket.roomId).emit('project-message', data);

            const aiIsPresentInMessage = message.includes('@ai');

            if (aiIsPresentInMessage) {
                io.to(socket.roomId).emit('ai-typing', { isTyping: true });

                try {
                    const prompt = message.replace('@ai', '').trim();

                    if (!prompt) {
                        io.to(socket.roomId).emit('project-message', {
                            message: 'Please provide a prompt after @ai',
                            sender: {
                                _id: 'ai',
                                email: 'AI'
                            }
                        });
                        io.to(socket.roomId).emit('ai-typing', { isTyping: false });
                        return;
                    }

                    console.log(`AI request from ${socket.user.email}: ${prompt.substring(0, 50)}...`);

                    const result = await generateResult(prompt);

                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });

                    if (result.error) {
                        console.error('AI Error:', result.text);
                        io.to(socket.roomId).emit('project-message', {
                            message: result.text,
                            sender: {
                                _id: 'ai',
                                email: 'AI'
                            },
                            error: true,
                            errorType: result.errorType
                        });
                        return;
                    }

                    let aiMessage = '';
                    
                    if (result.fileTree) {
                        aiMessage = result.text;
                        io.to(socket.roomId).emit('project-message', {
                            message: aiMessage,
                            sender: {
                                _id: 'ai',
                                email: 'AI'
                            },
                            fileTree: result.fileTree,
                            buildCommand: result.buildCommand,
                            startCommand: result.startCommand
                        });
                    } else {
                        aiMessage = result.text || JSON.stringify(result);
                        io.to(socket.roomId).emit('project-message', {
                            message: aiMessage,
                            sender: {
                                _id: 'ai',
                                email: 'AI'
                            }
                        });
                    }

                    console.log(`AI responded: ${aiMessage.substring(0, 50)}...`);

                } catch (aiError) {
                    console.error('AI Generation Error:', aiError.message);
                    
                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });

                    io.to(socket.roomId).emit('project-message', {
                        message: 'Sorry, I encountered an error processing your request. Please try again.',
                        sender: {
                            _id: 'ai',
                            email: 'AI'
                        },
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
        console.log(`User ${socket.user.email || socket.user._id} disconnected from project ${socket.roomId}`);
        socket.leave(socket.roomId);
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error.message);
    });
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

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
