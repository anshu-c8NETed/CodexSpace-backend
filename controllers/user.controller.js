import userModel from '../models/user.model.js';
import * as userService from '../services/user.service.js';
import { validationResult } from 'express-validator';
import redisClient from '../services/redis.service.js';

export const createUserController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }
    
    try {
        const { email } = req.body;
        
        // Check if user already exists
        const existingUser = await userModel.findOne({ email: email.toLowerCase().trim() });
        
        if (existingUser) {
            return res.status(400).json({ 
                message: 'An account with this email already exists. Please login instead.',
                errorType: 'duplicate_email'
            });
        }

        const user = await userService.createUser(req.body);
        const token = await user.generateJWT();

        // Convert to plain object and remove password
        const userObject = user.toObject();
        delete userObject.password;

        res.status(201).json({ 
            user: userObject, 
            token,
            message: 'Account created successfully'
        });
    } catch (error) {
        console.log('Registration error:', error);
        
        // Handle duplicate key error (MongoDB unique constraint)
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'An account with this email already exists. Please login instead.',
                errorType: 'duplicate_email'
            });
        }
        
        res.status(400).json({ 
            message: error.message || 'Registration failed. Please try again.',
            errorType: 'server_error'
        });
    }
}

export const loginController = async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            errors: errors.array(),
            message: errors.array()[0].msg 
        });
    }

    try {
        const { email, password } = req.body;

        // Find user with password field
        const user = await userModel.findOne({ email: email.toLowerCase().trim() }).select('+password');

        if (!user) {
            return res.status(401).json({
                message: 'Invalid email or password. Please check your credentials and try again.',
                errorType: 'invalid_credentials'
            });
        }

        // Verify password
        const isMatch = await user.isValidPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                message: 'Invalid email or password. Please check your credentials and try again.',
                errorType: 'invalid_credentials'
            });
        }

        const token = await user.generateJWT();

        // Convert to plain object and remove password
        const userObject = user.toObject();
        delete userObject.password;

        res.status(200).json({ 
            user: userObject, 
            token,
            message: 'Login successful'
        });

    } catch (err) {
        console.log('Login error:', err);
        res.status(500).json({ 
            message: 'An error occurred during login. Please try again.',
            errorType: 'server_error'
        });
    }
}

export const profileController = async (req, res) => {
    res.status(200).json({
        user: req.user
    });
}

export const logoutController = async (req, res) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

        if (token) {
            // Blacklist token in Redis
            await redisClient.set(token, 'logout', 'EX', 60 * 60 * 24);
        }

        res.status(200).json({
            message: 'Logged out successfully'
        });

    } catch (err) {
        console.log('Logout error:', err);
        res.status(400).json({ 
            message: 'Logout failed. Please try again.',
            errorType: 'server_error'
        });
    }
}

export const getAllUsersController = async (req, res) => {
    try {
        const loggedInUser = await userModel.findOne({
            email: req.user.email
        });

        if (!loggedInUser) {
            return res.status(404).json({ 
                message: 'User not found',
                errorType: 'user_not_found'
            });
        }

        const allUsers = await userService.getAllUsers({ userId: loggedInUser._id });

        return res.status(200).json({
            users: allUsers
        });

    } catch (err) {
        console.log('Get users error:', err);
        res.status(400).json({ 
            message: 'Failed to fetch users',
            errorType: 'server_error'
        });
    }
}
