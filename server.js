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
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        // Validate projectId
        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }

        // Find project
        socket.project = await projectModel.findById(projectId);

        if (!socket.project) {
            return next(new Error('Project not found'));
        }

        // Validate token
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
    
    // Join the project room
    socket.join(socket.roomId);

    socket.on('project-message', async data => {
        try {
            const message = data.message;

            if (!message || typeof message !== 'string') {
                socket.emit('error', { message: 'Invalid message format' });
                return;
            }

            // Broadcast message to other users in the room
            socket.broadcast.to(socket.roomId).emit('project-message', data);

            // Check if AI is mentioned
            const aiIsPresentInMessage = message.includes('@ai');

            if (aiIsPresentInMessage) {
                // Send "AI is typing" indicator
                io.to(socket.roomId).emit('ai-typing', { isTyping: true });

                try {
                    // Remove @ai and get the actual prompt
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

                    // Generate AI response
                    const result = await generateResult(prompt);

                    // Stop "AI is typing" indicator
                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });

                    // Handle error responses
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

                    // Send AI response
                    // Check if result has fileTree (code generation) or just text
                    let aiMessage = '';
                    
                    if (result.fileTree) {
                        // If AI generated code, send structured response
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
                        // If just text response
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
                    
                    // Stop "AI is typing" indicator
                    io.to(socket.roomId).emit('ai-typing', { isTyping: false });

                    // Send error message to user
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

    // Handle connection errors
    socket.on('error', (error) => {
        console.error('Socket error:', error.message);
    });
});

// Graceful shutdown
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